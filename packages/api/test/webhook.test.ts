import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { setup, projectId } from "./helpers.js";

async function webhook(app: Awaited<ReturnType<typeof setup>>["app"], event: string, payload: object) {
  const body = JSON.stringify(payload);

  return app.request("/api/github/webhook", { method: "POST", body, headers: {
    "x-github-event": event, "x-hub-signature-256": "sha256=" + createHmac("sha256", "test").update(body).digest("hex"),
  } });
}

test("removed repositories and deleted installations cannot ingest or replay", async (t) => {
  const { app, send } = await setup(t);

  await send({ submissionId: "old" });
  assert.equal((await webhook(app, "installation_repositories", {
    action: "removed", installation: { id: 1 }, repositories_removed: [{ full_name: "acme/shop" }],
  })).status, 200);
  assert.equal((await send({ submissionId: "old" })).status, 403);
});

test("suspension pauses ingestion and unsuspension restores existing repository access", async (t) => {
  const { app, send } = await setup(t);

  await webhook(app, "installation", { action: "suspend", installation: { id: 1 } });
  assert.equal((await send()).status, 403);
  await webhook(app, "installation", { action: "unsuspend", installation: { id: 1 } });
  assert.equal((await send()).status, 200);
  await webhook(app, "installation", { action: "deleted", installation: { id: 1 } });
  assert.equal((await send()).status, 403);
});

test("re-adding a removed repository rotates the key and discovers its default branch", async (t) => {
  const { app, db, state, send } = await setup(t);

  state.defaultBranch = "develop";
  await webhook(app, "installation_repositories", { action: "removed", installation: { id: 1 }, repositories_removed: [{ full_name: "acme/shop" }] });
  await webhook(app, "installation_repositories", { action: "added", installation: { id: 1 }, repositories_added: [{ full_name: "acme/shop" }] });
  const [project] = (await db.query("select api_key,default_branch,active from projects where id=$1", [projectId])).rows as any[];

  assert.notEqual(project.api_key, "key");
  assert.equal(project.default_branch, "develop");
  assert.equal(project.active, true);
  assert.equal((await send()).status, 401);
});

test("ingest refreshes a renamed default branch before resolving debt", async (t) => {
  const { send, state, db } = await setup(t);

  await send();
  state.defaultBranch = "develop";
  assert.equal((await send()).body.baselineUpdated, true);
  assert.equal((await db.query("select default_branch from projects")).rows[0].default_branch, "develop");
});
