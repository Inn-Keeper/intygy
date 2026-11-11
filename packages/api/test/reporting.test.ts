import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, violation, projectId } from "./helpers.js";

test("evidence reports unknown before scanning, findings when present and no claim of criterion conformance", async (t) => {
  const { app, send } = await setup(t);
  const evidence = async () => (await app.request(`/p/${projectId}/evidence`)).text();
  const initial = await evidence();

  assert.match(initial, /No verified default-branch scan/i);
  assert.doesNotMatch(initial, /Machine-verified on every merge|Merges monitored/);
  await send({ violations: [violation()] });
  const findings = await evidence();

  assert.match(findings, /Automated findings present/);
  await send();
  assert.match(await evidence(), /No automated findings in recorded coverage/);
});

test("scan detail exposes every finding and confines scans to their project", async (t) => {
  const { app, send } = await setup(t);
  const result = await send({ violations: Array.from({ length: 25 }, (_, i) => violation(`.button-${i}`)) });
  const response = await app.request(new URL(result.body.dashboardUrl).pathname);

  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /\.button-24/);
  assert.match(html, /Missing name/);
  assert.equal((await app.request(`/p/00000000-0000-4000-8000-000000000099/scans/${result.body.scanId}`)).status, 404);
});

test("evidence retains an explicit coverage gap for unscanned baseline findings", async (t) => {
  const { app, send } = await setup(t);

  await send({ routesScanned: ["/", "/checkout"], violations: [violation(".old", "/checkout")] });
  await send();
  const html = await (await app.request(`/p/${projectId}/evidence`)).text();

  assert.match(html, /outside the latest scan coverage/);
  assert.match(html, /1/);
});

test("missing projects have no evidence dossier", async (t) => {
  const { app } = await setup(t);

  assert.equal((await app.request("/p/00000000-0000-4000-8000-000000000099/evidence")).status, 404);
});

test("malformed project or scan ids are not found rather than server errors", async (t) => {
  const { app } = await setup(t);

  for (const path of ["/p/not-a-uuid", "/p/not-a-uuid/evidence", `/p/${projectId}/scans/not-a-uuid`]) {
    assert.equal((await app.request(path)).status, 404, path);
  }
});
