import { createHash } from "node:crypto";
import type { Violation } from "../../../shared/types";

/**
 * A violation's identity across scans: same rule, same route, same viewport,
 * same exact element selector. Ingest splits axe rule groups into individual
 * elements before hashing. Migration 001 preserves legacy first-element debt.
 */
export function fingerprint(v: Violation): string {
  const selector = v.nodes[0]?.selector ?? "";

  return "v2:" + createHash("sha256")
    .update(`${v.ruleId}|${v.route}|${v.viewport}|${selector}`)
    .digest("hex")
    .slice(0, 24);
}
