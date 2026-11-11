import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

test("committed Action bundle scans a page and submits the versioned contract", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "intygy-bundle-"));
  let submitted: any;
  let workflowToken: unknown;
  const server = createServer(async (req, res) => {
    // Stands in for the runner's OIDC endpoint, which appends the audience.
    if (req.url?.startsWith("/oidc")) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ value: `token-for-${new URL(req.url, "http://x").searchParams.get("audience")}` }));
      return;
    }

    if (req.url === "/api/ingest") {
      const chunks = [];

      for await (const chunk of req) chunks.push(chunk);

      submitted = JSON.parse(Buffer.concat(chunks).toString());
      workflowToken = req.headers["x-intygy-workflow-token"];
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ scanId: "scan", newCount: 0, baselineOpenCount: 1, blocked: false,
        dashboardUrl: "https://example.com/report", baselineUpdated: true }));
      return;
    }

    res.setHeader("content-type", "text/html");
    res.end('<!doctype html><html lang="en"><title>Fixture</title><body><main id="ready"><h1>Ready</h1><button></button></main></body></html>');
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });

  const address = server.address();

  assert.ok(address && typeof address !== "string");

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const config = join(directory, "intygy.yml");
  const bootstrap = join(directory, "browser.mjs");
  const summary = join(directory, "summary.md");
  const event = join(directory, "event.json");

  await writeFile(config, `target:\n  url: ${baseUrl}\nroutes: ["/"]\nreadySelector: "#ready"\n`);
  await writeFile(event, "{}");
  await writeFile(summary, "");
  await writeFile(bootstrap, `import { createRequire } from 'node:module';
    const require = createRequire(${JSON.stringify(resolve("packages/action/package.json"))});
    if (process.env.INTYGY_TEST_BROWSER_CHANNEL) {
      const { chromium } = require('playwright');
      const launch = chromium.launch.bind(chromium);
      chromium.launch = (options) => launch({ ...options, channel: process.env.INTYGY_TEST_BROWSER_CHANNEL });
    }`);

  const child = spawn(process.execPath, ["--import", bootstrap, resolve("packages/action/dist/index.js")], {
    env: { ...process.env, "INPUT_API-KEY": "test", "INPUT_API-BASE": baseUrl, "INPUT_CONFIG-PATH": config,
      INTYGY_SKIP_BROWSER_INSTALL: "1", GITHUB_REPOSITORY: "acme/shop", GITHUB_SHA: "abc123",
      GITHUB_REF: "refs/heads/main", GITHUB_EVENT_PATH: event, GITHUB_STEP_SUMMARY: summary,
      ACTIONS_ID_TOKEN_REQUEST_URL: `${baseUrl}/oidc?api-version=1`, ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";

  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  assert.equal(exitCode, 0, output);
  assert.equal(submitted.version, 2);
  assert.equal(workflowToken, `token-for-${baseUrl}`);
  assert.match(submitted.submissionId, /^[0-9a-f-]{36}$/);
  assert.deepEqual(submitted.viewports, ["desktop"]);
  assert.equal(submitted.violations.find((v: any) => v.ruleId === "button-name").nodes.length, 1);
});
