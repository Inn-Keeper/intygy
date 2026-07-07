/** Shared payload types between the Intygy Action and the Intygy API. */

export type ViewportName = "desktop" | "mobile";

export interface ViolationNode {
  /** CSS selector of the offending element, as reported by axe-core. */
  selector: string;
  /** Outer HTML snippet (truncated) for context in PR comments. */
  html?: string;
}

export interface Violation {
  ruleId: string;
  /** WCAG tags from axe, e.g. ["wcag2aa", "wcag241"] */
  wcag: string[];
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  description: string;
  helpUrl: string;
  route: string;
  viewport: ViewportName;
  nodes: ViolationNode[];
}

export interface ScanPayload {
  /** "owner/name" */
  repo: string;
  sha: string;
  branch?: string;
  /** Present when the scan ran on a pull request. */
  prNumber?: number;
  ruleset: string;
  routesScanned: string[];
  startedAt: string;
  finishedAt: string;
  violations: Violation[];
}

export interface IngestResponse {
  scanId: string;
  /** Violations not present in the project baseline. */
  newCount: number;
  /** Open (unresolved) baseline violations. */
  baselineOpenCount: number;
  /** True when newCount > 0 on a PR scan: the Action should fail the job. */
  blocked: boolean;
  dashboardUrl: string;
}
