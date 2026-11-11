import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { database } from "./database.js";

test("legacy migration preserves known first-element debt and dates without inventing other nodes", async (t) => {
  const db = await database(t);
  await db.exec(readFileSync("packages/api/test/fixtures/schema-v1.sql", "utf8"));
  await db.exec(`
    insert into installations values(1,'acme',now());
    insert into projects(id,repo,installation_id,api_key) values('00000000-0000-4000-8000-000000000001','acme/shop',1,'key');
    insert into scans(id,project_id,sha,branch,ruleset,routes,started_at,finished_at)
      values('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','old','main','wcag22-aa','["/"]',now(),now());
    insert into violations(id,scan_id,fingerprint,rule_id,wcag,route,viewport,selector,description,help_url)
      values(gen_random_uuid(),'00000000-0000-4000-8000-000000000002','old-fingerprint','button-name','["wcag412"]','/','desktop','.old','Missing name','https://example.com');
    insert into baselines values('00000000-0000-4000-8000-000000000001','old-fingerprint','2026-01-01','2026-01-02');
    insert into baselines values('00000000-0000-4000-8000-000000000001','unrecoverable','2026-01-01',null);
  `);

  const migration = readFileSync("db/migrations/001-flow-integrity.sql", "utf8");

  await db.exec(migration);
  await db.exec(migration);

  const [known] = (await db.query("select * from baselines where legacy_fingerprint='old-fingerprint'")).rows as any[];

  assert.equal(known.fingerprint, "v2:c01f69eac26249db29f2a944");
  assert.equal(known.selector, ".old");
  assert.equal(known.first_seen.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(known.resolved_at.toISOString(), "2026-01-02T00:00:00.000Z");
  assert.equal((await db.query("select count(*)::int as n from baselines")).rows[0].n, 2);
  assert.equal((await db.query("select count(*)::int as n from baseline_events")).rows[0].n, 3);
  assert.equal((await db.query("select baseline_initialized from projects")).rows[0].baseline_initialized, true);
});
