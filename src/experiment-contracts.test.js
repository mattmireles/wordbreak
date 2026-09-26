import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("experiment schemas compile and accept representative immutable artifacts", () => {
  const output = execFileSync(process.execPath, ["scripts/experiment/validate-schemas.mjs"], { encoding: "utf8" });
  assert.match(output, /Validated 4 JSON schemas/);
});

