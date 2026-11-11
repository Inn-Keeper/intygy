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
  version: 2;
  /** Stable across transport retries; a new workflow attempt uses a new ID. */
  submissionId: string;
  /** "owner/name" */
  repo: string;
  sha: string;
  branch?: string;
  /** Present when the scan ran on a pull request. */
  prNumber?: number;
  ruleset: string;
  routesScanned: string[];
  /** All routes were successfully scanned at every listed viewport. */
  viewports: ViewportName[];
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
  baselineUpdated: boolean;
  /** Explains a stale or non-default-branch scan that did not update the baseline. */
  notice?: string;
}
