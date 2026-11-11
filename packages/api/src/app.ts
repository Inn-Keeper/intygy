import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";
import { q as defaultQuery, transaction as defaultTransaction, openBaselineFingerprints, type Query } from "./lib/db.js";
import { ingest, IngestError, type VerifyRepository } from "./lib/ingest.js";
import { verifyRepository as defaultVerifyRepository } from "./lib/github.js";
import { commentOnPr as defaultComment } from "./lib/github.js";
import { buildPrComment } from "./lib/comment.js";
import { renderEvidence } from "./lib/evidence.js";
import { ScanPayloadSchema } from "./lib/payload.js";
import { applyWebhook, WebhookSchema } from "./lib/webhook.js";
import { renderScan } from "./lib/report.js";
import { esc, pageShell } from "./lib/html.js";

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function createApp(deps: {
  query?: Query;
  transact?: typeof defaultTransaction;
  verifyRepository?: VerifyRepository;
  postComment?: typeof defaultComment;
  webhookSecret?: string;
  baseUrl?: string;
} = {}) {
  const q = deps.query ?? defaultQuery;
  const transaction = deps.transact ?? defaultTransaction;
  const commentOnPr = deps.postComment ?? defaultComment;
  const WEBHOOK_SECRET = deps.webhookSecret ?? process.env.GITHUB_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    throw new Error("GITHUB_WEBHOOK_SECRET is not set — refusing to start with a forgeable webhook signature.");
  }

  const app = new Hono();
  const BASE = (deps.baseUrl ?? process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  /* ------------------------------------------------------------------ */
  /* Ingest: called by the Intygy Action                                  */
  /* ------------------------------------------------------------------ */
  app.onError((error, c) => {
    if (error instanceof IngestError) return c.json({ error: error.message }, error.status);

    // Database errors can carry query parameters, including credentials.
    console.error("Request failed:", error.name);
    return c.json({ error: "request failed" }, 500);
  });

  app.post("/api/ingest", async (c) => {
    const apiKey = (c.req.header("authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];

    if (!apiKey) return c.json({ error: "missing api key" }, 401);

    const [authorized] = await q("select id from projects where api_key=$1", [apiKey]);

    if (!authorized) return c.json({ error: "unknown api key" }, 401);

    const parsed = ScanPayloadSchema.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) {
      return c.json({ error: "invalid scan payload; upgrade the Intygy Action to payload version 2",
        issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
    }

    const payload = parsed.data;
    const result = await transaction((query) => ingest(query, apiKey, payload, BASE, deps.verifyRepository ?? defaultVerifyRepository));

    if (!result.replay && result.response.blocked && payload.prNumber) {
      await commentOnPr(result.installationId, payload.repo, payload.prNumber,
        buildPrComment(result.newViolations, result.response.dashboardUrl))
        .catch(() => console.error("PR comment failed; findings remain available in the scan report."));
    }

    return c.json(result.response);
  });

  /* ------------------------------------------------------------------ */
  /* GitHub webhook: track installations, create projects                 */
  /* ------------------------------------------------------------------ */
  app.post("/api/github/webhook", async (c) => {
    const body = await c.req.text();
    const sig = c.req.header("x-hub-signature-256") ?? "";
    const expected = "sha256=" + createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return c.text("bad signature", 401);

    const event = c.req.header("x-github-event") ?? "";

    if (!["installation", "installation_repositories"].includes(event)) return c.text("ok");

    const parsed = WebhookSchema.safeParse(await Promise.resolve().then(() => JSON.parse(body)).catch(() => null));

    if (!parsed.success) return c.json({ error: "invalid webhook payload" }, 400);

    await transaction((query) => applyWebhook(query, event, parsed.data, deps.verifyRepository ?? defaultVerifyRepository));
    return c.text("ok");
  });

  /* ------------------------------------------------------------------ */
  /* Minimal dashboard + evidence export                                  */
  /* ------------------------------------------------------------------ */
  // Postgres rejects non-UUID ids with an error; answer 404 before querying.
  app.use("/p/*", async (c, next) => {
    const [, , id, , scanId] = c.req.path.split("/");

    if (!UUID.test(id ?? "") || (scanId !== undefined && !UUID.test(scanId))) return c.text("not found", 404);

    await next();
  });

  app.get("/p/:id", async (c) => {
    const id = c.req.param("id");
    const [project] = await q<{ repo: string }>("select repo from projects where id=$1", [id]);
    if (!project) return c.text("not found", 404);
    const scans = await q<{ id: string; sha: string; pr_number: number | null; created_at: string; n: string }>(
      `select s.id, s.sha, s.pr_number, s.created_at, count(v.id) as n
       from scans s left join violations v on v.scan_id = s.id
       where s.project_id = $1 group by s.id order by s.created_at desc limit 20`, [id]
    );
    const open = await openBaselineFingerprints(id, q);
    const rows = scans.map((s) =>
      `<tr><td>${esc(s.created_at.toString().slice(0, 16))}</td><td>${s.pr_number ? "PR #" + esc(String(s.pr_number)) : "branch"}</td>
       <td><a href="/p/${esc(id)}/scans/${esc(s.id)}"><code>${esc(s.sha.slice(0, 7))}</code></a></td><td>${esc(String(s.n))}</td></tr>`).join("");
    return c.html(pageShell(`Intygy — ${project.repo}`, `<h1>${esc(project.repo)}</h1>
  <p>Open tracked issues (baseline): <strong>${open.size}</strong> · <a href="/p/${esc(id)}/evidence">Export evidence dossier →</a></p>
  <h2>Recent scans</h2><table><tr><th>When</th><th>Context</th><th>Commit</th><th>Findings</th></tr>${rows}</table>`));
  });

  app.get("/p/:id/evidence", async (c) => {
    const html = await renderEvidence(c.req.param("id"), q);

    return html === null ? c.text("not found", 404) : c.html(html);
  });

  app.get("/p/:id/scans/:scanId", async (c) => {
    const html = await renderScan(q, c.req.param("id"), c.req.param("scanId"));

    return html === null ? c.text("not found", 404) : c.html(html);
  });

  app.get("/healthz", (c) => c.text("ok"));

  return app;
}
