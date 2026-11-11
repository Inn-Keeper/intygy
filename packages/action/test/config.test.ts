import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigSchema } from "../src/config";

test("serve target keeps serve command and default timeout", () => {
  const config = ConfigSchema.parse({
    target: { serve: "npm run start", url: "http://localhost:3000" },
    routes: ["/"],
    readySelector: "main",
  });
  assert.deepEqual(config.target, {
    serve: "npm run start",
    url: "http://localhost:3000",
    readyTimeoutMs: 120_000,
  });
});

test("plain url target still parses", () => {
  const config = ConfigSchema.parse({
    target: { url: "https://staging.example.com" },
    routes: ["/"],
    readySelector: "main",
  });
  assert.deepEqual(config.target, { url: "https://staging.example.com" });
});

test("routes cannot escape the target origin through URL normalization", () => {
  for (const route of ["//example.org/path", "/\\example.org/path", "/\n/example.org/path", "/\t/example.org/path"]) {
    assert.equal(ConfigSchema.safeParse({ routes: [route], readySelector: "main" }).success, false);
  }
});
