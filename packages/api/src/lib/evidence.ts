import { q, openBaselineFingerprints } from "./db.js";
import { esc, pageShell } from "./html.js";

/**
 * EN 301 549 / WCAG 2.2 AA criteria register (MVP subset — extend to the full
 * list before selling; each entry maps to axe rule coverage or manual testing).
 */
export const CRITERIA: Array<{ sc: string; name: string; automatable: "full" | "partial" | "manual" }> = [
  { sc: "1.1.1", name: "Non-text Content", automatable: "partial" },
  { sc: "1.3.1", name: "Info and Relationships", automatable: "partial" },
  { sc: "1.4.3", name: "Contrast (Minimum)", automatable: "full" },
  { sc: "1.4.11", name: "Non-text Contrast", automatable: "partial" },
  { sc: "2.1.1", name: "Keyboard", automatable: "partial" },
  { sc: "2.4.1", name: "Bypass Blocks", automatable: "full" },
  { sc: "2.4.7", name: "Focus Visible", automatable: "partial" },
  { sc: "2.4.11", name: "Focus Not Obscured (Minimum)", automatable: "partial" },
  { sc: "2.5.8", name: "Target Size (Minimum)", automatable: "partial" },
  { sc: "3.1.1", name: "Language of Page", automatable: "full" },
  { sc: "3.2.2", name: "On Input", automatable: "manual" },
  { sc: "3.3.2", name: "Labels or Instructions", automatable: "partial" },
  { sc: "4.1.2", name: "Name, Role, Value", automatable: "full" },
  { sc: "1.2.2", name: "Captions (Prerecorded)", automatable: "manual" },
  { sc: "2.4.3", name: "Focus Order", automatable: "manual" },
];

export async function renderEvidence(projectId: string): Promise<string> {
  const [project] = await q<{ repo: string; created_at: string }>(
    "select repo, created_at from projects where id = $1",
    [projectId]
  );
  const [stats] = await q<{ scans: string; first: string | null; last: string | null }>(
    "select count(*) as scans, min(created_at) as first, max(created_at) as last from scans where project_id = $1",
    [projectId]
  );
  const open = await openBaselineFingerprints(projectId);
  const [resolved] = await q<{ n: string }>(
    "select count(*) as n from baselines where project_id = $1 and resolved_at is not null",
    [projectId]
  );
  const attestations = await q<{ criterion: string; attested_by: string; attested_at: string }>(
    "select criterion, attested_by, attested_at from attestations where project_id = $1",
    [projectId]
  );
  const attested = new Map(attestations.map((a) => [a.criterion, a]));

  const rows = CRITERIA.map((c) => {
    const a = attested.get(c.sc);
    const status =
      c.automatable === "full"
        ? "Machine-verified on every merge"
        : a
          ? `Manually attested by ${esc(a.attested_by)} on ${new Date(a.attested_at).toISOString().slice(0, 10)}`
          : c.automatable === "partial"
            ? "Partially machine-verified — manual attestation pending"
            : "Manual attestation pending";
    return `<tr><td>${c.sc}</td><td>${esc(c.name)}</td><td>${status}</td></tr>`;
  }).join("\n");

  return pageShell(`Accessibility Evidence Dossier — ${project?.repo ?? projectId}`, `
<h1>Accessibility Evidence Dossier</h1>
<p class="meta">Project: <strong>${esc(project?.repo ?? "")}</strong> · Generated ${new Date().toISOString().slice(0, 10)} · Standard: EN 301 549 (WCAG 2.2 AA)</p>
<h2>Continuous monitoring</h2>
<p>Merges monitored: <strong>${stats?.scans ?? 0}</strong> (${stats?.first?.toString().slice(0, 10) ?? "—"} → ${stats?.last?.toString().slice(0, 10) ?? "—"}).
Baseline issues resolved: <strong>${resolved?.n ?? 0}</strong>. Open tracked issues: <strong>${open.size}</strong>.</p>
<h2>Conformance register</h2>
<table><tr><th>Criterion</th><th>Name</th><th>Status</th></tr>${rows}</table>
<h2>Accessibility statement (draft)</h2>
<p>${esc(project?.repo ?? "This service")} is monitored for accessibility on every code change using automated
WCAG 2.2 AA checks, with manual attestations recorded for criteria automation cannot verify. Known issues are
tracked with dated history. This statement is regenerated automatically and reflects status as of the date above.</p>
<p class="meta">Note: automated checks cover only part of WCAG. This dossier separates machine-verified results
from manual attestations and does not by itself constitute a claim of full EAA conformance.</p>`);
}
