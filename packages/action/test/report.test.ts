import { test } from "node:test";
import assert from "node:assert/strict";
import { submitScan } from "../src/report";
import type { ScanPayload } from "../../shared/types";

const payload: ScanPayload = {
  version: 2, submissionId: "run-1", repo: "acme/shop", sha: "abc", ruleset: "wcag22-aa",
  routesScanned: ["/"], viewports: ["desktop"], startedAt: "2026-11-11T10:00:00.000Z",
  finishedAt: "2026-11-11T10:01:00.000Z", violations: [],
};

test("transport retries preserve the complete submission and return the committed result", async (t) => {
  const requests: string[] = [];
  const result = { scanId: "scan", newCount: 0, baselineOpenCount: 0, blocked: false,
    dashboardUrl: "https://example.com/report", baselineUpdated: true };

  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    requests.push(String(init.body));
    if (requests.length === 1) throw new Error("connection lost after commit");

    return Response.json(result);
  });
  assert.deepEqual(await submitScan("https://example.com", "key", payload), result);
  assert.equal(requests.length, 2);
  assert.equal(requests[0], requests[1]);
});

test("invalid successful response never turns into a green check", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({}));

  await assert.rejects(submitScan("https://example.com", "key", payload), /invalid.*response/i);
});
