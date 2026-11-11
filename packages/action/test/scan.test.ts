import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { runScan } from "../src/scan";
import { ConfigSchema } from "../src/config";
import { chromium } from "playwright";

const html = (body: string) => `<!doctype html><html lang="en"><head><title>Test</title></head><body><main>${body}</main></body></html>`;

test("scanner refuses HTTP errors, redirects and failed authentication, and keeps every node", async (t) => {
  if (process.env.INTYGY_TEST_BROWSER_CHANNEL) {
    const launch = chromium.launch.bind(chromium);

    t.mock.method(chromium, "launch", () => launch({ headless: true, channel: process.env.INTYGY_TEST_BROWSER_CHANNEL }));
  }

  const server = createServer((req, res) => {
    res.setHeader("content-type", "text/html");
    if (req.url === "/error") { res.writeHead(503); res.end(html("Unavailable")); return; }
    if (req.url === "/private") { res.writeHead(302, { location: "/login" }); res.end(); return; }
    if (req.url === "/login") {
      res.end(html('<form><input type="email"><input type="password"><button type="submit">Login</button></form>'));
      return;
    }
    res.end(html('<div id="ready">Ready</div>' + '<button></button>'.repeat(7)));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const address = server.address();

  assert.ok(address && typeof address !== "string");

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const config = (routes: string[], extra = {}) => ConfigSchema.parse({ routes, readySelector: "#ready", target: { url: baseUrl }, ...extra });

  await t.test("HTTP error is not a clean scan", async () => {
    await assert.rejects(runScan(config(["/error"]), baseUrl), /HTTP 503/);
  });
  await t.test("redirected route is not scanned as its original URL", async () => {
    await assert.rejects(runScan(config(["/private"]), baseUrl), /redirect/i);
  });
  await t.test("login requires proof of authenticated state", async () => {
    await assert.rejects(runScan(config(["/"], {
      auth: { login_url: "/login", user: "a@example.com", pass: "bad", success_selector: "#signed-in" },
      readyTimeoutMs: 100,
    }), baseUrl), /authenticat/i);
  });
  await t.test("missing application readiness fails the scan", async () => {
    await assert.rejects(runScan(config(["/"], { readySelector: "#missing", readyTimeoutMs: 100 }), baseUrl), /ready|Timeout/i);
  });
  await t.test("all seven failing buttons survive scanning", async () => {
    const result = await runScan(config(["/"], { readySelector: "#ready" }), baseUrl);

    assert.equal(result.find((v) => v.ruleId === "button-name")?.nodes.length, 7);
  });
});
