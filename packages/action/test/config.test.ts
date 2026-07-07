import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigSchema } from "../src/config";

test("serve target keeps serve command and default timeout", () => {
  const config = ConfigSchema.parse({
    target: { serve: "npm run start", url: "http://localhost:3000" },
    routes: ["/"],
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
  });
  assert.deepEqual(config.target, { url: "https://staging.example.com" });
});
