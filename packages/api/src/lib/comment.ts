import type { Violation } from "../../../shared/types";

const WCAG_NAMES: Record<string, string> = {
  wcag241: "2.4.1 Bypass Blocks",
  wcag247: "2.4.7 Focus Visible",
  wcag2411: "2.4.11 Focus Not Obscured",
  wcag143: "1.4.3 Contrast (Minimum)",
  wcag111: "1.1.1 Non-text Content",
  wcag131: "1.3.1 Info and Relationships",
  wcag412: "4.1.2 Name, Role, Value",
  wcag258: "2.5.8 Target Size (Minimum)",
  wcag332: "3.3.2 Labels or Instructions",
};

export function criterionLabel(tags: string[]): string {
  for (const t of tags) if (WCAG_NAMES[t]) return WCAG_NAMES[t];
  // wcagXYZ… = major X, minor Y, criterion Z… (the third segment can be two digits, e.g. wcag2412 → 2.4.12)
  const m = tags.map((t) => /^wcag(\d)(\d)(\d{1,2})$/.exec(t)).find(Boolean);
  return m ? `WCAG ${m[1]}.${m[2]}.${m[3]}` : "WCAG";
}

export function buildPrComment(newViolations: Violation[], dashboardUrl: string): string {
  const lines: string[] = [
    `## Intygy — ${newViolations.length} new accessibility violation${newViolations.length === 1 ? "" : "s"}`,
    "",
    "These were introduced by this PR (pre-existing baseline issues don't block).",
    "",
  ];
  for (const v of newViolations.slice(0, 20)) {
    const node = v.nodes[0];
    lines.push(
      `### \`${v.ruleId}\` — ${criterionLabel(v.wcag)}`,
      `**Route:** \`${v.route}\` (${v.viewport}) · **Impact:** ${v.impact ?? "n/a"}`,
      `**Element:** \`${node?.selector ?? "unknown"}\``,
      node?.html ? `\`\`\`html\n${node.html}\n\`\`\`` : "",
      `${v.description} — [how to fix](${v.helpUrl})`,
      ""
    );
  }
  if (newViolations.length > 20) lines.push(`…and ${newViolations.length - 20} more in the dashboard.`);
  lines.push("", `[Full report & baseline →](${dashboardUrl})`);
  return lines.filter((l) => l !== undefined).join("\n");
}
