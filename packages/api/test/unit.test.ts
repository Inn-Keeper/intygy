import { test } from "node:test";
import assert from "node:assert/strict";
import { fingerprint } from "../src/lib/fingerprint.js";
import { criterionLabel } from "../src/lib/comment.js";
import { ScanPayloadSchema } from "../src/lib/payload.js";
import type { Violation } from "../../shared/types";

const violation = (viewport: Violation["viewport"]): Violation => ({
  ruleId: "color-contrast",
  wcag: ["wcag2aa", "wcag143"],
  impact: "serious",
  description: "d",
  helpUrl: "https://example.com",
  route: "/",
  viewport,
  nodes: [{ selector: ".btn" }],
});

test("same violation on different viewports gets distinct fingerprints", () => {
  assert.notEqual(fingerprint(violation("desktop")), fingerprint(violation("mobile")));
});

test("distinct sibling elements must not share a fingerprint", () => {
  const a = violation("desktop");
  const b = { ...a, nodes: [{ selector: ".btn:nth-child(3)" }] };
  assert.notEqual(fingerprint(a), fingerprint(b));
});

test("versioned payload rejects missing coverage and retry identity", () => {
  const legacy = {
    repo: "acme/shop", sha: "abc123", ruleset: "wcag22-aa", routesScanned: ["/"],
    startedAt: "2026-07-07T10:00:00.000Z", finishedAt: "2026-07-07T10:01:00.000Z", violations: [],
  };

  assert.equal(ScanPayloadSchema.safeParse(legacy).success, false);
});

test("criterion label fallback handles two-digit sub-criteria", () => {
  assert.equal(criterionLabel(["wcag2412"]), "WCAG 2.4.12");
  assert.equal(criterionLabel(["wcag325"]), "WCAG 3.2.5");
});

test("ingest payload schema accepts a valid scan and rejects junk", () => {
  const valid = {
    version: 2,
    submissionId: "run-1-attempt-1",
    repo: "acme/shop",
    sha: "abc123",
    ruleset: "wcag22-aa",
    routesScanned: ["/"],
    viewports: ["desktop"],
    startedAt: "2026-07-07T10:00:00.000Z",
    finishedAt: "2026-07-07T10:01:00.000Z",
    violations: [violation("desktop")],
  };
  assert.ok(ScanPayloadSchema.safeParse(valid).success);
  assert.equal(ScanPayloadSchema.safeParse(null).success, false);
  assert.equal(ScanPayloadSchema.safeParse({ ...valid, violations: [{ ruleId: 1 }] }).success, false);
  assert.equal(ScanPayloadSchema.safeParse({ ...valid, repo: "not-owner-slash-name" }).success, false);
});
