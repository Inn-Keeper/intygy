import { createHash } from "node:crypto";
import type { Violation } from "../../../shared/types";

/**
 * A violation's identity across scans: same rule, same route, same viewport,
 * same first selector. Selector is normalized (nth-child noise stripped) so
 * trivial DOM reshuffles don't produce "new" violations.
 */
export function fingerprint(v: Violation): string {
  const selector = (v.nodes[0]?.selector ?? "").replace(/:nth-child\(\d+\)/g, "");
  return createHash("sha256")
    .update(`${v.ruleId}|${v.route}|${v.viewport}|${selector}`)
    .digest("hex")
    .slice(0, 24);
}
