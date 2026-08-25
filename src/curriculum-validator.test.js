import assert from "node:assert/strict";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { extractRuntime } from "../scripts/runtime-data.mjs";
import { reservedAssessmentLeaks, validateRuntime, visibleTokens } from "../scripts/curriculum/validate-content.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("released curriculum keeps its fixed core and validated disabled field pack", () => {
  assert.deepEqual(validateRuntime(root), {
    coreUnits: 48,
    coreWords: 192,
    packUnits: 4,
    packWords: 16,
  });
});

test("visible token normalization covers HTML, entities, and Unicode NFC", () => {
  const tokens = visibleTokens({
    docs: [{ b: "<p>CAF&#x45;&nbsp;&amp; re&#769;sume&#769;</p>" }],
    prompt: "Alpha-beta",
  });
  assert.deepEqual(tokens, ["cafe", "résumé", "alpha", "beta"]);
});

test("assessment reservation scans every nested teaching surface", () => {
  const { assessment } = extractRuntime(root);
  const target = assessment.A[0].target;
  for (const surface of [
    { docs: [{ b: `<b>${target}</b>` }] },
    { docs: [{ ty: target }] },
    { words: [{ a: target }] },
    { words: [{ p: { cl: `Use ${target} here.` } }] },
    { words: [{ fork: { items: [{ role: "witness", w: target }] } }] },
    { words: [{ fork: { qs: [{ q: `Choose ${target}` }] } }] },
    { teachingAudio: [`${target}.`] },
  ]) {
    assert.deepEqual(reservedAssessmentLeaks(surface, assessment), [target]);
  }
});

test("assessment clips remain outside the teaching-content scan", () => {
  const { assessment } = extractRuntime(root);
  const target = assessment.A[0].target;
  const teachingOnly = { docs: [{ b: "A clean unrelated lesson." }], words: [] };
  assert.deepEqual(reservedAssessmentLeaks(teachingOnly, assessment), []);
  assert.ok(assessment.A[0].audioText.toLowerCase().includes(target));
});
