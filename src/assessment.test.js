import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { extractRuntime } from "../scripts/runtime-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function runFixture(data, form = "A") {
  const order = data.assessment[form].map((item) => item.id);
  return {
    id: "test-run",
    role: "baseline",
    form,
    status: "in_progress",
    order,
    cursor: 0,
    responses: [],
    replays: { [order[0]]: 1 },
    startedAt: Date.now(),
    completedAt: null,
    completedNonbonusTotal: null,
    interruptions: 0,
    comparable: true,
    reasons: [],
    device: { userAgent: "wordbreak-test", platform: "test" },
    staticAudioFailed: false,
  };
}

test("forms remain frozen, disjoint, and evenly matched by primary tripwire", () => {
  const { assessment } = extractRuntime(root);
  assert.equal(assessment.version, 2);
  assert.equal(assessment.A.length, 24);
  assert.equal(assessment.B.length, 24);
  assert.equal(new Set([...assessment.A, ...assessment.B].map((item) => item.target)).size, 48);
  const counts = (form) => Object.fromEntries([...new Set(form.map((item) => item.primaryCode))]
    .map((code) => [code, form.filter((item) => item.primaryCode === code).length]));
  assert.deepEqual(counts(assessment.A), counts(assessment.B));
});

test("normalization is deliberately exact beyond NFC, trim, and case", () => {
  const { helpers } = extractRuntime(root);
  assert.equal(helpers.assessmentNormalize("  CAFÉ  "), "café");
  assert.notEqual(helpers.assessmentNormalize("book keeper"), "bookkeeper");
  assert.notEqual(helpers.assessmentNormalize("with-hold"), "withhold");
});

test("seeded order is deterministic without changing the frozen bank", () => {
  const data = extractRuntime(root);
  const ids = data.assessment.A.map((item) => item.id);
  const first = Array.from(data.helpers.assessmentShuffle(ids, "same-seed"));
  const second = Array.from(data.helpers.assessmentShuffle(ids, "same-seed"));
  assert.deepEqual(first, second);
  assert.deepEqual(ids, data.assessment.A.map((item) => item.id));
  assert.notDeepEqual(first, Array.from(data.helpers.assessmentShuffle(ids, "other-seed")));
});

test("scoring counts exact spellings once under predeclared codes", () => {
  const data = extractRuntime(root);
  const run = runFixture(data);
  const [one, two] = data.assessment.A;
  run.responses = [{ itemId: one.id, response: one.target.toUpperCase() }, { itemId: two.id, response: `${two.target}x` }];
  const score = data.helpers.assessmentScore(run);
  assert.equal(score.correct, 1);
  assert.equal(score.total, 24);
  assert.deepEqual(JSON.parse(JSON.stringify(score.groups.E1)), { correct: 1, attempted: 2 });
});

test("a committed response advances once and leaves teaching/reporting metrics untouched", () => {
  const data = extractRuntime(root);
  const run = runFixture(data);
  data.state.assessment.assignment = "A";
  data.state.assessment.runs = [run];
  const reportingBefore = JSON.stringify(data.state.reporting);
  const logBefore = JSON.stringify(data.state.log);
  const item = data.assessment.A[0];
  assert.equal(data.helpers.submitAssessmentResponse(item.id, item.target), true);
  assert.equal(run.cursor, 1);
  assert.equal(run.responses.length, 1);
  assert.equal(data.helpers.submitAssessmentResponse(item.id, item.target), true);
  assert.equal(run.cursor, 1);
  assert.equal(run.responses.length, 1);
  assert.equal(JSON.stringify(data.state.reporting), reportingBefore);
  assert.equal(JSON.stringify(data.state.log), logBefore);
});

test("reload resumes at the next unanswered item", () => {
  const storage = {
    values: new Map(), failWrites: false,
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, value); },
    removeItem(key) { this.values.delete(key); },
  };
  const first = extractRuntime(root, { storage });
  const run = runFixture(first);
  first.state.assessment.assignment = "A";
  first.state.assessment.runs = [run];
  const item = first.assessment.A[0];
  assert.equal(first.helpers.submitAssessmentResponse(item.id, item.target), true);
  const reloaded = extractRuntime(root, { storage });
  assert.equal(reloaded.helpers.assessmentPhase(), "baseline_in_progress");
  assert.equal(reloaded.state.assessment.runs[0].cursor, 1);
  assert.equal(reloaded.state.assessment.runs[0].responses[0].itemId, item.id);
});

test("storage failure rolls the assessment ledger back to the same item", () => {
  const storage = {
    values: new Map(), failWrites: false,
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { if (this.failWrites) throw new Error("storage full"); this.values.set(key, value); },
    removeItem(key) { this.values.delete(key); },
  };
  const data = extractRuntime(root, { storage });
  const run = runFixture(data);
  data.state.assessment.assignment = "A";
  data.state.assessment.runs = [run];
  const item = data.assessment.A[0];
  storage.failWrites = true;
  assert.equal(data.helpers.submitAssessmentResponse(item.id, item.target), false);
  assert.equal(data.state.assessment.runs[0].cursor, 0);
  assert.equal(data.state.assessment.runs[0].responses.length, 0);
});

test("follow-up gate uses elapsed calendar days and the monotonic completion total", () => {
  const data = extractRuntime(root);
  const run = runFixture(data);
  run.status = "completed";
  run.completedAt = Date.now() - 29 * 86400000;
  run.completedNonbonusTotal = 7;
  data.state.assessment.assignment = "A";
  data.state.assessment.runs = [run];
  data.state.assessment.nonbonusCompletedTotal = 19;
  assert.equal(data.helpers.assessmentPhase(), "baseline_complete");
  assert.equal(data.helpers.assessmentEligibility().eligible, true);
});

test("all 24 immutable responses freeze one completed baseline", () => {
  const data = extractRuntime(root);
  const run = runFixture(data);
  data.state.assessment.assignment = "A";
  data.state.assessment.runs = [run];
  for (const item of data.assessment.A) {
    run.replays[item.id] = 1;
    assert.equal(data.helpers.submitAssessmentResponse(item.id, item.target), true);
  }
  assert.equal(run.status, "completed");
  assert.equal(run.responses.length, 24);
  assert.equal(run.completedNonbonusTotal, data.state.assessment.nonbonusCompletedTotal);
  assert.equal(data.helpers.assessmentPhase(), "baseline_complete");
});

test("pagehide records an interruption without abandoning the run", () => {
  const data = extractRuntime(root);
  const run = runFixture(data);
  data.state.assessment.assignment = "A";
  data.state.assessment.runs = [run];
  data.screen.screen = "assessment";
  data.helpers.reportPagehide();
  assert.equal(run.interruptions, 1);
  assert.equal(run.status, "in_progress");
});

test("an invalid imported assessment ledger is quarantined without erasing ordinary progress", () => {
  const storage = {
    values: new Map([["wb2", JSON.stringify({ docs: { "4.1": true }, cleared: { "4.1": true }, log: [], sessions: [], assessment: { version: 999 } })]]),
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, value); },
    removeItem(key) { this.values.delete(key); },
  };
  const data = extractRuntime(root, { storage });
  assert.equal(data.state.cleared["4.1"], true);
  assert.equal(data.state.assessment.version, 2);
  assert.equal(data.state.assessment.runs[0].status, "corrupt_noncomparable");
});
