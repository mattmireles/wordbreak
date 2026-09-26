import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("Mathbreak content validates every authored equation and strategy route", () => {
  const output = execFileSync(process.execPath, ["scripts/math/validate-content.mjs"], { encoding: "utf8" });
  assert.match(output, /Validated Mathbreak v1/);
});

