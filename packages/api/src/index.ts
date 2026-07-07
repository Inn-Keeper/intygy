import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { randomUUID, createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { q, openBaselineFingerprints } from "./lib/db.js";
import { fingerprint } from "./lib/fingerprint.js";
import { commentOnPr } from "./lib/github.js";
import { buildPrComment } from "./lib/comment.js";
import { renderEvidence } from "./lib/evidence.js";
import { ScanPayloadSchema } from "./lib/payload.js";
import { esc, pageShell } from "./lib/html.js";
import type { IngestResponse, Violation } from "../../shared/types";

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  throw new Error("GITHUB_WEBHOOK_SECRET is not set — refusing to start with a forgeable webhook signature.");
}

const app = new Hono();
const BASE = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/* ------------------------------------------------------------------ */
/* Ingest: called by the Intygy Action                                  */
/* ------------------------------------------------------------------ */
app.post("/api/ingest", async (c) => {
  const auth = c.req.header("authorization") ?? "";
  const apiKey = auth.replace(/^Bearer\s+/i, "");
  if (!apiKey) return c.json({ error: "missing api key" }, 401);

  const [project] = await q<{ id: string; repo: string; installation_id: number | null; default_branch: string }>(
    "select id, repo, installation_id, default_branch from projects where api_key = $1",
    [apiKey]
  );
  if (!project) return c.json({ error: "unknown api key" }, 401);

  const parsed = ScanPayloadSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return c.json({ error: "invalid scan payload", issues }, 400);
  }
  const payload = parsed.data;
  if (payload.repo !== project.repo)
    return c.json({ error: `api key belongs to ${project.repo}, scan came from ${payload.repo}` }, 403);

  const scanId = randomUUID();
  await q(
    `insert into scans (id, project_id, sha, branch, pr_number, ruleset, routes, started_at, finished_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [scanId, project.id, payload.sha, payload.branch ?? null, payload.prNumber ?? null,
     payload.ruleset, JSON.stringify(payload.routesScanned), payload.startedAt, payload.finishedAt]
  );

  const seen = new Map<string, Violation>();
  for (const v of payload.violations) seen.set(fingerprint(v), v);

  for (const [fp, v] of seen) {
    await q(
      `insert into violations (id, scan_id, fingerprint, rule_id, wcag, impact, route, viewport, selector, description, help_url)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [randomUUID(), scanId, fp, v.ruleId, JSON.stringify(v.wcag), v.impact, v.route, v.viewport,
       v.nodes[0]?.selector ?? "", v.description, v.helpUrl]
    );
  }

  const baseline = await openBaselineFingerprints(project.id);
  const isFirstScan = baseline.size === 0 &&
    (await q<{ n: string }>("select count(*) as n from scans where project_id = $1", [project.id]))[0].n === "1";

  const newViolations: Violation[] = [];
  for (const [fp, v] of seen) if (!baseline.has(fp)) newViolations.push(v);

  const dashboardUrl = `${BASE}/p/${project.id}`;
  let blocked = false;

  if (isFirstScan || !payload.prNumber) {
    /* Baseline run, or a push to a branch (e.g. merge to main): absorb into baseline. */
    await absorbIntoBaseline(project.id, seen.keys());
    if (!isFirstScan && payload.branch === project.default_branch) {
      await resolveClearedBaseline(project.id, baseline, seen);
    }
  } else {
    blocked = newViolations.length > 0;
    if (blocked && project.installation_id) {
      await commentOnPr(project.installation_id, project.repo, payload.prNumber,
        buildPrComment(newViolations, dashboardUrl)).catch((e) => console.error("comment failed:", e));
    }
  }

  const res: IngestResponse = {
    scanId,
    newCount: payload.prNumber && !isFirstScan ? newViolations.length : 0,
    baselineOpenCount: (await openBaselineFingerprints(project.id)).size,
    blocked,
    dashboardUrl,
  };
  return c.json(res);
});

async function absorbIntoBaseline(projectId: string, fps: Iterable<string>): Promise<void> {
  for (const fp of fps) {
    await q(
      `insert into baselines (project_id, fingerprint, first_seen)
       values ($1,$2,now()) on conflict (project_id, fingerprint) do update set resolved_at = null`,
      [projectId, fp]
    );
  }
}

/** Anything in baseline but absent from a main-branch scan is resolved. */
async function resolveClearedBaseline(
  projectId: string,
  baseline: Set<string>,
  seen: Map<string, Violation>
): Promise<void> {
  for (const fp of baseline) {
    if (!seen.has(fp))
      await q("update baselines set resolved_at = now() where project_id=$1 and fingerprint=$2", [projectId, fp]);
  }
}

/* ------------------------------------------------------------------ */
/* GitHub webhook: track installations, create projects                 */
/* ------------------------------------------------------------------ */
app.post("/api/github/webhook", async (c) => {
  const body = await c.req.text();
  const sig = c.req.header("x-hub-signature-256") ?? "";
  const expected = "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return c.text("bad signature", 401);

  const event = c.req.header("x-github-event");
  const data = JSON.parse(body);

  if (event === "installation" && (data.action === "created" || data.action === "unsuspend")) {
    await q(
      "insert into installations (id, account) values ($1,$2) on conflict (id) do nothing",
      [data.installation.id, data.installation.account?.login ?? ""]
    );
    for (const r of data.repositories ?? []) await ensureProject(r.full_name, data.installation.id);
  }
  if (event === "installation_repositories") {
    for (const r of data.repositories_added ?? []) await ensureProject(r.full_name, data.installation.id);
  }
  return c.text("ok");
});

async function ensureProject(repo: string, installationId: number): Promise<void> {
  const apiKey = "igy_" + randomBytes(24).toString("hex");
  await q(
    `insert into projects (id, repo, installation_id, api_key)
     values ($1,$2,$3,$4)
     on conflict (repo) do update set installation_id = excluded.installation_id`,
    [randomUUID(), repo, installationId, apiKey]
  );
  console.log(`Project ready for ${repo}`);
}

/* ------------------------------------------------------------------ */
/* Minimal dashboard + evidence export                                  */
/* ------------------------------------------------------------------ */
app.get("/p/:id", async (c) => {
  const id = c.req.param("id");
  const [project] = await q<{ repo: string }>("select repo from projects where id=$1", [id]);
  if (!project) return c.text("not found", 404);
  const scans = await q<{ sha: string; pr_number: number | null; created_at: string; n: string }>(
    `select s.sha, s.pr_number, s.created_at, count(v.id) as n
     from scans s left join violations v on v.scan_id = s.id
     where s.project_id = $1 group by s.id order by s.created_at desc limit 20`, [id]
  );
  const open = await openBaselineFingerprints(id);
  const rows = scans.map((s) =>
    `<tr><td>${esc(s.created_at.toString().slice(0, 16))}</td><td>${s.pr_number ? "PR #" + esc(String(s.pr_number)) : "branch"}</td>
     <td><code>${esc(s.sha.slice(0, 7))}</code></td><td>${esc(s.n)}</td></tr>`).join("");
  return c.html(pageShell(`Intygy — ${project.repo}`, `<h1>${esc(project.repo)}</h1>
<p>Open tracked issues (baseline): <strong>${open.size}</strong> · <a href="/p/${esc(id)}/evidence">Export evidence dossier →</a></p>
<h2>Recent scans</h2><table><tr><th>When</th><th>Context</th><th>Commit</th><th>Findings</th></tr>${rows}</table>`));
});

app.get("/p/:id/evidence", async (c) => c.html(await renderEvidence(c.req.param("id"))));

app.get("/healthz", (c) => c.text("ok"));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`Intygy API listening on :${port}`);
