import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, violation, projectId, signed } from "./helpers.js";
import { linkQuery } from "../src/lib/links.js";

test("evidence reports unknown before scanning, findings when present and no claim of criterion conformance", async (t) => {
  const { app, send } = await setup(t);
  const evidence = async () => (await app.request(signed(`/p/${projectId}/evidence`))).text();
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
  const other = "00000000-0000-4000-8000-000000000099";
  const result = await send({ violations: Array.from({ length: 25 }, (_, i) => violation(`.button-${i}`)) });
  const report = new URL(result.body.dashboardUrl);
  const response = await app.request(report.pathname + report.search);

  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /\.button-24/);
  assert.match(html, /Missing name/);
  assert.equal((await app.request(signed(`/p/${other}/scans/${result.body.scanId}`, other))).status, 404);
});

test("evidence retains an explicit coverage gap for unscanned baseline findings", async (t) => {
  const { app, send } = await setup(t);

  await send({ routesScanned: ["/", "/checkout"], violations: [violation(".old", "/checkout")] });
  await send();
  const html = await (await app.request(signed(`/p/${projectId}/evidence`))).text();

  assert.match(html, /outside the latest scan coverage/);
  assert.match(html, /1/);
});

test("missing projects have no evidence dossier", async (t) => {
  const { app } = await setup(t);

  assert.equal((await app.request(signed("/p/00000000-0000-4000-8000-000000000099/evidence", "00000000-0000-4000-8000-000000000099"))).status, 404);
});

test("dashboard pages keep their URLs out of referrers, indexes and shared caches", async (t) => {
  const { app } = await setup(t);
  const response = await app.request(signed(`/p/${projectId}/evidence`));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-robots-tag"), "noindex");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("malformed project or scan ids are not found rather than server errors", async (t) => {
  const { app } = await setup(t);

  for (const path of ["/p/not-a-uuid", "/p/not-a-uuid/evidence", `/p/${projectId}/scans/not-a-uuid`]) {
    assert.equal((await app.request(signed(path))).status, 404, path);
  }
});

test("project pages open only through unexpired links signed for that project", async (t) => {
  const { app, send } = await setup(t);
  const path = `/p/${projectId}/evidence`;
  const monthAndADay = 31 * 24 * 60 * 60 * 1000;

  await send();
  assert.equal((await app.request(path)).status, 404);
  assert.equal((await app.request(path + linkQuery("wrong-secret", projectId))).status, 404);
  assert.equal((await app.request(path + linkQuery("link-secret", "00000000-0000-4000-8000-000000000099"))).status, 404);
  assert.equal((await app.request(path + linkQuery("link-secret", projectId, Date.now() - monthAndADay))).status, 404);

  // Every project link on a page carries the visitor's signature, so navigation keeps working.
  const html = await (await app.request(signed(path))).text();
  const links = [...html.matchAll(/href="(\/p\/[^"]+)"/g)].map((m) => m[1].replaceAll("&amp;", "&"));

  assert.ok(links.length >= 2);

  for (const link of links) assert.equal((await app.request(link)).status, 200, link);
});
