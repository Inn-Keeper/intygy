import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, violation } from "./helpers.js";

test("adding a failing element blocks while reordered existing elements do not", async (t) => {
  const { send } = await setup(t);
  const group = { ...violation(), nodes: [{ selector: ".a" }, { selector: ".b" }] };

  assert.equal((await send({ violations: [group] })).body.blocked, false);
  assert.equal((await send({ prNumber: 1, violations: [{ ...group, nodes: [...group.nodes].reverse() }] })).body.blocked, false);
  const added = await send({ prNumber: 1, violations: [{ ...group, nodes: [...group.nodes, { selector: ".c" }] }] });

  assert.equal(added.body.blocked, true);
  assert.equal(added.body.newCount, 1);
});

test("feature branches cannot accept debt and default branch fixes resolve it", async (t) => {
  const { send } = await setup(t);

  await send();
  await send({ branch: "feature", violations: [violation()] });
  assert.equal((await send({ prNumber: 1, violations: [violation()] })).body.blocked, true);
  assert.equal((await send({ violations: [violation()] })).body.baselineOpenCount, 1);
  assert.equal((await send()).body.baselineOpenCount, 0);
});

test("reduced route, viewport or ruleset coverage never resolves untested debt", async (t) => {
  const { send } = await setup(t);

  await send({ routesScanned: ["/", "/checkout"], viewports: ["desktop", "mobile"], violations: [
    violation(".checkout", "/checkout"), violation(".mobile", "/", "mobile"), violation(".desktop"),
  ] });
  assert.equal((await send({ ruleset: "wcag21-aa" })).body.baselineOpenCount, 3);
  assert.equal((await send()).body.baselineOpenCount, 2);
  assert.equal((await send({ routesScanned: ["/", "/checkout"], viewports: ["desktop", "mobile"] })).body.baselineOpenCount, 0);
});

test("a stale default branch scan cannot reopen fixed debt", async (t) => {
  const { send, state } = await setup(t);

  await send({ violations: [violation()] });
  state.headSha = "main-2";
  await send();
  const stale = await send({ sha: "main-1", violations: [violation()] });

  assert.equal(stale.body.baselineOpenCount, 0);
  assert.equal(stale.body.baselineUpdated, false);
});

test("retries return the first result and reject a different payload with the same ID", async (t) => {
  const { send, db } = await setup(t);
  const payload = { submissionId: "retry", prNumber: 1, violations: [violation()] };
  const first = await send(payload);
  const retry = await send(payload);

  assert.deepEqual(retry, first);
  assert.equal((await db.query("select count(*)::int as n from scans")).rows[0].n, 1);
  assert.equal((await send({ ...payload, violations: [] })).status, 409);
});

test("resolution and reopening retain every dated event", async (t) => {
  const { send, db } = await setup(t);

  await send({ violations: [violation()] });
  await send();
  await send({ violations: [violation()] });
  await send();
  const events = await db.query("select kind from baseline_events order by id");

  assert.deepEqual(events.rows.map((e: any) => e.kind), ["observed", "resolved", "reopened", "resolved"]);
});

test("real SQL failure rolls back the scan and its baseline writes", async (t) => {
  const { send, db } = await setup(t);

  await db.exec(`create function reject_baseline() returns trigger language plpgsql as $$
    begin raise exception 'test write failure'; end; $$;
    create trigger reject_baseline before insert on baselines for each row execute function reject_baseline();`);
  assert.equal((await send({ violations: [violation()] })).status, 500);
  assert.equal((await db.query("select count(*)::int as n from scans")).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int as n from violations")).rows[0].n, 0);
});

test("simultaneous first PR scans establish exactly one baseline", async (t) => {
  const { send } = await setup(t);
  const results = await Promise.all([
    send({ prNumber: 1, violations: [violation(".a")] }),
    send({ prNumber: 2, violations: [violation(".b")] }),
  ]);

  assert.deepEqual(results.map((r) => r.body.blocked).sort(), [false, true]);
  assert.equal(results.filter((r) => r.body.baselineUpdated).length, 1);
});

test("a comment failure cannot undo a committed scan or hide its report", async (t) => {
  const { send, db, state } = await setup(t);

  state.commentFails = true;
  await send();
  const result = await send({ prNumber: 1, violations: [violation()] });

  assert.equal(result.status, 200);
  assert.equal(result.body.blocked, true);
  assert.equal((await db.query("select count(*)::int as n from scans")).rows[0].n, 2);
});
