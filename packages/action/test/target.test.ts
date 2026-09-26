import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { AXE_CORE_VERSION, PLAYWRIGHT_VERSION } from "../src/target";

const req = createRequire(import.meta.url);

test("runtime-installed versions match the ones we develop against", () => {
  assert.equal(PLAYWRIGHT_VERSION, req("playwright/package.json").version);
  assert.equal(AXE_CORE_VERSION, req("axe-core/package.json").version);
});
