import type { Query } from "./db.js";
import { esc, pageShell } from "./html.js";
import type { IngestResponse } from "../../../shared/types";

export async function renderScan(query: Query, projectId: string, scanId: string): Promise<string | null> {
  const [scan] = await query<{ repo: string; sha: string; branch: string; routes: string[]; viewports: string[] | null; ruleset: string; result: IngestResponse | null }>(
    `select p.repo,s.sha,s.branch,s.routes,s.viewports,s.ruleset,s.result from scans s
     join projects p on p.id=s.project_id where s.project_id=$1 and s.id=$2`, [projectId, scanId]
  );

  if (!scan) return null;

  const findings = await query<{ rule_id: string; route: string; viewport: string; selector: string; description: string; help_url: string; impact: string | null }>(
    "select rule_id,route,viewport,selector,description,help_url,impact from violations where scan_id=$1 order by route,viewport,rule_id,selector", [scanId]
  );
  const rows = findings.map((v) => {
    const help = /^https?:\/\//i.test(v.help_url) ? `<a href="${esc(v.help_url)}" rel="noreferrer">How to fix</a>` : "";

    return `<tr><td>${esc(v.rule_id)}<br>${esc(v.impact ?? "unknown")}</td><td>${esc(v.route)} (${esc(v.viewport)})</td>
      <td><code>${esc(v.selector)}</code></td><td>${esc(v.description)} ${help}</td></tr>`;
  }).join("");

  return pageShell(`Scan report — ${scan.repo}`, `<h1>Scan report</h1>
<p><a href="/p/${esc(projectId)}">Project dashboard</a> · <a href="/p/${esc(projectId)}/evidence">Evidence history</a></p>
<p>${esc(scan.repo)} · Commit <code>${esc(scan.sha)}</code> · ${esc(scan.branch ?? "unknown branch")}</p>
<p>${scan.result ? scan.result.blocked ? `Blocked: ${scan.result.newCount} new findings.` : "No blocking regression in this scan." : "Legacy scan: gate result was not recorded."}
${esc(scan.result?.notice ?? "")}</p>
<p>Ruleset: ${esc(scan.ruleset)}. Routes: ${scan.routes.map(esc).join(", ")}.
Viewports: ${scan.viewports?.map(esc).join(", ") ?? "not recorded (legacy scan)"}.</p>
<h2>All findings (${findings.length})</h2>
<table><tr><th>Rule / impact</th><th>Page</th><th>Element</th><th>Finding</th></tr>${rows}</table>`);
}
