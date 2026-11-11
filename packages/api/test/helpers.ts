import { readFileSync } from "node:fs";
import { database } from "./database.js";
import { createApp } from "../src/app.js";
import type { Query } from "../src/lib/db.js";
export const projectId = "00000000-0000-4000-8000-000000000001";
export const violation = (selector = ".old", route = "/", viewport = "desktop") => ({
  ruleId: "button-name", wcag: ["wcag412"], impact: "critical", description: "Missing name",
  helpUrl: "https://example.com/fix", route, viewport, nodes: [{ selector }],
});

export async function setup(t: import("node:test").TestContext) {
  const db = await database(t);
  await db.exec(readFileSync("db/schema.sql", "utf8"));
  await db.exec(`insert into installations(id,account) values(1,'acme');
    insert into projects(id,repo,installation_id,api_key) values('${projectId}','acme/shop',1,'key')`);

  const query: Query = async (sql, params) => (await db.query(sql, params)).rows as any;
  const state = { defaultBranch: "main", headSha: "main-1", commentFails: false };
  let comments = 0;
  const app = createApp({
    query,
    transact: (work) => db.transaction((tx) => work(async (sql, params) => (await tx.query(sql, params)).rows as any)),
    verifyRepository: async () => ({ ...state }),
    postComment: async () => { comments++; if (state.commentFails) throw new Error("GitHub unavailable"); },
    webhookSecret: "test", baseUrl: "https://intygy.test",
  });
  let sequence = 0;
  const send = async (changes: Record<string, unknown> = {}) => {
    const response = await app.request("/api/ingest", {
      method: "POST", headers: { authorization: "Bearer key", "content-type": "application/json" },
      body: JSON.stringify({ version: 2, submissionId: `run-${++sequence}`, repo: "acme/shop",
        sha: state.headSha, branch: state.defaultBranch, ruleset: "wcag22-aa",
        routesScanned: ["/"], viewports: ["desktop"], startedAt: "2026-11-11T10:00:00.000Z",
        finishedAt: "2026-11-11T10:01:00.000Z", violations: [], ...changes }),
    });

    return { status: response.status, body: await response.json() as any };
  };

  return { db, app, send, state, comments: () => comments };
}

