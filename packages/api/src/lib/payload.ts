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
  nodes: z.array(z.object({ selector: z.string(), html: z.string().optional() })),
});

export const ScanPayloadSchema: z.ZodType<ScanPayload> = z.object({
  repo: z.string().regex(/^[^/]+\/[^/]+$/, 'expected "owner/name"'),
  sha: z.string().min(1),
  branch: z.string().optional(),
  prNumber: z.number().int().positive().optional(),
  ruleset: z.string(),
  routesScanned: z.array(z.string()),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  violations: z.array(ViolationSchema),
});
