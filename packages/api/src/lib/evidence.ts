import { q as defaultQuery, openBaselineFingerprints, type Query } from "./db.js";
import { esc, pageShell } from "./html.js";

/**
 * EN 301 549 / WCAG 2.2 AA criteria register (MVP subset — extend to the full
 * list before selling; each entry maps to axe rule coverage or manual testing).
 */
export const CRITERIA: Array<{ sc: string; name: string; automatable: "partial" | "manual" }> = [
  { sc: "1.1.1", name: "Non-text Content", automatable: "partial" },
  { sc: "1.3.1", name: "Info and Relationships", automatable: "partial" },
  { sc: "1.4.3", name: "Contrast (Minimum)", automatable: "partial" },
  { sc: "1.4.11", name: "Non-text Contrast", automatable: "partial" },
  { sc: "2.1.1", name: "Keyboard", automatable: "partial" },
  { sc: "2.4.1", name: "Bypass Blocks", automatable: "partial" },
  { sc: "2.4.7", name: "Focus Visible", automatable: "partial" },
  { sc: "2.4.11", name: "Focus Not Obscured (Minimum)", automatable: "partial" },
  { sc: "2.5.8", name: "Target Size (Minimum)", automatable: "partial" },
  { sc: "3.1.1", name: "Language of Page", automatable: "partial" },
  { sc: "3.2.2", name: "On Input", automatable: "manual" },
  { sc: "3.3.2", name: "Labels or Instructions", automatable: "partial" },
  { sc: "4.1.2", name: "Name, Role, Value", automatable: "partial" },
  { sc: "1.2.2", name: "Captions (Prerecorded)", automatable: "manual" },
  { sc: "2.4.3", name: "Focus Order", automatable: "manual" },
];

export async function renderEvidence(projectId: string, q: Query = defaultQuery): Promise<string | null> {
  const [project] = await q<{ repo: string; default_branch: string }>(
    "select repo, default_branch from projects where id=$1", [projectId]
  );

  if (!project) return null;

  const [stats] = await q<{ scans: string }>("select count(*) as scans from scans where project_id=$1", [projectId]);
  const [latest] = await q<{ id: string; sha: string; ruleset: string; routes: string[]; viewports: string[]; finished_at: Date }>(
    `select id,sha,ruleset,routes,viewports,finished_at from scans where project_id=$1
     and baseline_updated and pr_number is null and branch=$2 order by created_at desc,id desc limit 1`,
    [projectId, project.default_branch]
  );
  const findings = latest ? await q<{ wcag: string[] }>("select wcag from violations where scan_id=$1", [latest.id]) : [];
  const open = await openBaselineFingerprints(projectId, q);
  const [outside] = latest ? await q<{ n: string }>(
    `select count(*) as n from baselines where project_id=$1 and resolved_at is null
     and (route is null or viewport is null or ruleset is null or not (route=any($2::text[]) and viewport=any($3::text[]) and ruleset=$4))`,
    [projectId, latest.routes, latest.viewports, latest.ruleset]
  ) : [{ n: String(open.size) }];
  const events = await q<{ kind: string; occurred_at: Date; scan_id: string | null; fingerprint: string; source: string }>(
    "select kind,occurred_at,scan_id,fingerprint,source from baseline_events where project_id=$1 order by id desc", [projectId]
  );
  const attestations = await q<{ criterion: string; attested_by: string; attested_at: Date }>(
    "select criterion,attested_by,attested_at from attestations where project_id=$1", [projectId]
  );
  const attested = new Map(attestations.map((a) => [a.criterion, a]));
  const summary = !latest ? "No verified default-branch scan recorded. Coverage is unknown."
    : findings.length ? `Automated findings present: ${findings.length}.`
      : "No automated findings in recorded coverage. This is not a conformance verdict.";
  const rows = CRITERIA.map((criterion) => {
    const count = findings.filter((v) => v.wcag.includes(`wcag${criterion.sc.replaceAll(".", "")}`)).length;
    const attestation = attested.get(criterion.sc);
    const status = count ? `Automated findings present: ${count}. Manual review required.`
      : criterion.automatable === "manual" ? "Manual review required."
        : !latest ? "Unknown — no verified default-branch scan."
          : "No recorded automated finding for this criterion; manual review required.";
    const note = attestation ? ` Attested by ${esc(attestation.attested_by)} on ${new Date(attestation.attested_at).toISOString().slice(0, 10)} (recorded attestation; not proof for the current commit).` : " No manual attestation recorded.";

    return `<tr><td>${criterion.sc}</td><td>${esc(criterion.name)}</td><td>${status}${note}</td></tr>`;
  }).join("\n");
  const history = events.map((event) => `<tr><td>${new Date(event.occurred_at).toISOString()}</td>
    <td>${esc(event.kind)}${event.source === "legacy" ? " (imported legacy record)" : ""}</td>
    <td><code>${esc(event.fingerprint)}</code></td><td>${event.scan_id
      ? `<a href="/p/${esc(projectId)}/scans/${esc(event.scan_id)}">Scan report</a>` : "Legacy snapshot"}</td></tr>`).join("");

  return pageShell(`Accessibility evidence — ${project.repo}`, `
<h1>Accessibility evidence</h1>
<p><a href="/p/${esc(projectId)}">Project dashboard</a></p>
<p>Project: <strong>${esc(project.repo)}</strong>. Generated ${new Date().toISOString().slice(0, 10)}.</p>
<h2>Recorded coverage</h2>
<p>${summary}</p>
${latest ? `<p>Last verified default-branch scan: <a href="/p/${esc(projectId)}/scans/${esc(latest.id)}">${esc(latest.sha)}</a>
on ${new Date(latest.finished_at).toISOString()}. Ruleset: ${esc(latest.ruleset)}.</p>
<p>Routes: ${latest.routes.map(esc).join(", ")}. Viewports: ${latest.viewports.map(esc).join(", ")}.</p>` : ""}
<p>Accepted scans (including PRs): ${stats.scans}. Open tracked issues: ${open.size}.
Open findings outside the latest scan coverage: ${outside.n}. These have not been verified as fixed.</p>
<h2>Partial criteria register</h2>
<p>This is a partial WCAG evidence register supporting manual review. Automated scans cannot establish full WCAG or EN 301 549 conformance.</p>
<table><tr><th>Criterion</th><th>Name</th><th>Recorded evidence</th></tr>${rows}</table>
<h2>Issue history</h2>
<p>Resolution events: ${events.filter((e) => e.kind === "resolved").length}. Reopened findings retain earlier resolution events.
Legacy records contain only the dates available at migration; missing earlier cycles cannot be reconstructed.</p>
<table><tr><th>When</th><th>Event</th><th>Finding</th><th>Evidence</th></tr>${history}</table>`);
}
