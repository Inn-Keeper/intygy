import { z } from "zod";
import type { ScanPayload } from "../../../shared/types";

const ViolationSchema = z.object({
  ruleId: z.string(),
  wcag: z.array(z.string()),
  impact: z.enum(["minor", "moderate", "serious", "critical"]).nullable(),
  description: z.string(),
  helpUrl: z.string(),
  route: z.string(),
  viewport: z.enum(["desktop", "mobile"]),
  nodes: z.array(z.object({ selector: z.string().min(1), html: z.string().optional() })).min(1),
});

export const ScanPayloadSchema: z.ZodType<ScanPayload> = z.object({
  version: z.literal(2),
  submissionId: z.string().min(1).max(200),
  repo: z.string().regex(/^[^/]+\/[^/]+$/, 'expected "owner/name"'),
  sha: z.string().min(1),
  branch: z.string().optional(),
  prNumber: z.number().int().positive().optional(),
  ruleset: z.enum(["wcag22-aa", "wcag21-aa"]),
  routesScanned: z.array(z.string().startsWith("/")).min(1),
  viewports: z.array(z.enum(["desktop", "mobile"])).min(1),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  violations: z.array(ViolationSchema),
}).superRefine((payload, ctx) => {
  if (payload.finishedAt < payload.startedAt) {
    ctx.addIssue({ code: "custom", message: "finishedAt precedes startedAt" });
  }

  for (const v of payload.violations) {
    if (!payload.routesScanned.includes(v.route) || !payload.viewports.includes(v.viewport)) {
      ctx.addIssue({ code: "custom", message: "violation lies outside scanned coverage" });
    }
  }
});
