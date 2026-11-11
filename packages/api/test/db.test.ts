import { test } from "node:test";
import assert from "node:assert/strict";
import { runTransaction, type TransactionClient } from "../src/lib/db.js";

function clientRecording(statements: string[], failOn?: string) {
  let released = false;
  const client: TransactionClient = {
    async query(text) {
      statements.push(text);
      if (text === failOn) throw new Error(`${text} failed`);
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };
  return { client, wasReleased: () => released };
}

test("transaction commits successful database work and releases the client", async () => {
  const statements: string[] = [];
  const { client, wasReleased } = clientRecording(statements);

  const result = await runTransaction(client, async (query) => {
    await query("insert into scans values ($1)", ["scan-id"]);
    return "saved";
  });

  assert.equal(result, "saved");
  assert.deepEqual(statements, ["BEGIN", "insert into scans values ($1)", "COMMIT"]);
  assert.equal(wasReleased(), true);
});

test("transaction rolls back failed database work and releases the client", async () => {
  const statements: string[] = [];
  const { client, wasReleased } = clientRecording(statements);
  const failure = new Error("violation insert failed");

  await assert.rejects(
    runTransaction(client, async (query) => {
      await query("insert into scans values ($1)", ["scan-id"]);
      throw failure;
    }),
    failure
  );

  assert.deepEqual(statements, ["BEGIN", "insert into scans values ($1)", "ROLLBACK"]);
  assert.equal(wasReleased(), true);
});

test("transaction releases the client without rollback when begin fails", async () => {
  const statements: string[] = [];
  const { client, wasReleased } = clientRecording(statements, "BEGIN");

  await assert.rejects(runTransaction(client, async () => "unused"), /BEGIN failed/);

  assert.deepEqual(statements, ["BEGIN"]);
  assert.equal(wasReleased(), true);
});

test("transaction preserves the work error when rollback also fails", async () => {
  const statements: string[] = [];
  const { client, wasReleased } = clientRecording(statements, "ROLLBACK");
  const workFailure = new Error("work failed");

  await assert.rejects(
    runTransaction(client, async () => {
      throw workFailure;
    }),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors.map((item) => item.message), ["work failed", "ROLLBACK failed"]);
      return true;
    }
  );

  assert.deepEqual(statements, ["BEGIN", "ROLLBACK"]);
  assert.equal(wasReleased(), true);
});
