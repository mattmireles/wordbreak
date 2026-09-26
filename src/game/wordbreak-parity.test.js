import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { makeScenarios } from "../../scripts/generate-wordbreak-golden.mjs";
import { extractRuntime } from "../../scripts/runtime-data.mjs";

const root = resolve(new URL("../..", import.meta.url).pathname);
const goldenRoot = resolve(root, "test/fixtures/wordbreak-golden");
const nowMs = Date.UTC(2026, 8, 22, 23, 0, 0);

function nodeCore(state, uuid = "00000000-0000-4000-8000-000000000001") {
  const context = { TextEncoder };
  context.globalThis = context;
  runInNewContext(
    `${readFileSync(resolve(root, "src/game/wordbreak-content.js"), "utf8")}\n${readFileSync(resolve(root, "src/game/wordbreak-core.js"), "utf8")}`,
    context,
  );
  return context.WordbreakCore.create({
    stateJson: JSON.stringify(state || {}),
    content: context.createWordbreakContent(2),
    nowMs,
    timezoneOffsetMinutes: 420,
    random: () => 17 / 256,
    uuid: () => uuid,
  });
}

function commit(core, action) {
  const output = core.dispatch(action);
  core.accept(output.stateJson);
  return output;
}

function browserStorage(state) {
  const values = new Map([["wb2", JSON.stringify(state)]]);
  return {
    values,
    failWrites: false,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) {
      if (this.failWrites) throw new Error("storage full");
      values.set(key, value);
    },
    removeItem(key) { values.delete(key); },
  };
}

function withoutProvenance(value) {
  const copy = structuredClone(value);
  delete copy.sourceSha256;
  return copy;
}

test("generated browser independently replays every frozen legacy trace", () => {
  const legacy = makeScenarios();
  const generated = makeScenarios({ htmlPath: "wordbreak_v2.html" });

  for (const [name, expected] of Object.entries(legacy)) {
    const frozen = JSON.parse(readFileSync(resolve(goldenRoot, `${name}.json`), "utf8"));
    assert.deepEqual(expected, frozen, `${name} no longer matches the frozen pre-extraction trace`);
    assert.deepEqual(
      withoutProvenance(generated[name]),
      withoutProvenance(expected),
      `${name} diverged in the generated browser artifact`,
    );
  }
});

test("generated browser exports validated content and engine hashes", () => {
  const runtime = extractRuntime(root);
  assert.match(runtime.runtimeHashes.contentHash, /^[a-f0-9]{64}$/);
  assert.match(runtime.runtimeHashes.contentSourceHash, /^[a-f0-9]{64}$/);
  assert.match(runtime.runtimeHashes.engineHash, /^[a-f0-9]{64}$/);
});

test("Node core replays the frozen clean-word transition", () => {
  const expected = JSON.parse(readFileSync(resolve(goldenRoot, "correct.json"), "utf8"));
  const core = nodeCore({ docs: { "1.1": true } });
  commit(core, { type: "unit.openRun", unitId: "1.1" });
  commit(core, { type: "word.commitTyped", value: "sunset" });
  commit(core, { type: "word.setFlag", index: 2 });
  commit(core, { type: "word.execute" });
  const actual = commit(core, { type: "word.confirmDone" });
  assert.deepEqual(JSON.parse(actual.stateJson), expected.state);
  assert.deepEqual(JSON.parse(JSON.stringify(actual.viewModel)), expected.screen);
});

test("Node core replays the frozen fault-and-patch transition", () => {
  const expected = JSON.parse(readFileSync(resolve(goldenRoot, "miss.json"), "utf8"));
  const core = nodeCore({ docs: { "1.1": true } });
  commit(core, { type: "unit.openRun", unitId: "1.1" });
  commit(core, { type: "word.commitTyped", value: "sunsetx" });
  commit(core, { type: "word.setFlag", index: 0 });
  commit(core, { type: "word.execute" });
  commit(core, { type: "word.toPatch" });
  const actual = commit(core, { type: "word.commitPatch", value: "sunset" });
  assert.deepEqual(JSON.parse(actual.stateJson), expected.state);
  assert.deepEqual(JSON.parse(JSON.stringify(actual.viewModel)), expected.screen);
});

test("Node core replays the frozen assessment-start boundary", () => {
  const expected = JSON.parse(readFileSync(resolve(goldenRoot, "assessmentBoundaries.json"), "utf8"));
  const core = nodeCore({}, "00000000-0000-4000-8000-000000000002");
  const actual = commit(core, {
    type: "assessment.start",
    role: "baseline",
    device: { userAgent: "wordbreak-test", platform: "test" },
  });
  assert.deepEqual(JSON.parse(actual.stateJson), expected.state);
  assert.deepEqual(JSON.parse(JSON.stringify(actual.viewModel)), expected.screen);
});

test("Node core preserves the frozen reload state and unknown fields", () => {
  const miss = JSON.parse(readFileSync(resolve(goldenRoot, "miss.json"), "utf8"));
  const expected = JSON.parse(readFileSync(resolve(goldenRoot, "reload.json"), "utf8"));
  const core = nodeCore(miss.state);
  const actual = core.dispatch({ type: "state.read" });
  assert.deepEqual(JSON.parse(actual.stateJson), expected.state);
  assert.deepEqual(JSON.parse(JSON.stringify(actual.viewModel)), expected.screen);
});

test("Node core replays unknown field-pack quarantine without data loss", () => {
  const expected = JSON.parse(readFileSync(resolve(goldenRoot, "fieldPackTransitions.json"), "utf8"));
  const core = nodeCore({});
  const baseline = JSON.parse(core.dispatch({ type: "state.read" }).stateJson);
  baseline.fieldPack = { version: 99, unitIds: ["10.1"] };
  baseline.docs["10.1"] = true;
  baseline.cleared["10.1"] = true;
  baseline.sched["10.1|future"] = { unit: "10.1", word: "future", due: 1 };
  const actual = core.dispatch({ type: "progress.import", state: baseline });
  assert.deepEqual(JSON.parse(actual.stateJson), expected.result.state);
  assert.equal(actual.semanticEvents[0].quarantined, true);
});

test("Node core replays the frozen session-completion boundary", () => {
  const expected = JSON.parse(readFileSync(resolve(goldenRoot, "sessionCompletion.json"), "utf8"));
  const before = structuredClone(expected.state);
  before.session.done = false;
  before.session.status = "in_progress";
  before.session.revision = 1;
  delete before.session.endedAt;
  before.sessions[0].status = "in_progress";
  before.sessions[0].revision = 1;
  before.sessions[0].endedAt = null;
  const report = before.reporting.days[before.session.startReportDay];
  report.sessionsCompleted = 0;
  report.revision = 1;
  before.reporting.sourceRevision = 1;
  before.assessment.nonbonusCompletedTotal = 0;
  const core = nodeCore(before);
  const actual = commit(core, { type: "session.complete" });
  assert.deepEqual(JSON.parse(actual.stateJson), expected.state);
  assert.deepEqual(JSON.parse(JSON.stringify(actual.viewModel)), expected.screen);
});

test("browser storage failure leaves core actions retryable and suppresses completion", () => {
  const storage = browserStorage({ docs: { "1.1": true } });
  const runtime = extractRuntime(root, {
    storage,
    nowMs,
    uuidValues: ["00000000-0000-4000-8000-000000000001"],
    randomValues: [17, 29, 43, 61],
  });
  const word = runtime.units[0].words[0];

  runtime.actions.openRun("1.1");
  runtime.app.value = word.a;
  storage.failWrites = true;
  runtime.actions.commitTyped();
  assert.equal(runtime.screen.phase, "type");
  assert.equal(runtime.state.log.length, 0);

  storage.failWrites = false;
  runtime.actions.commitTyped();
  runtime.actions.setFlag(2);
  runtime.actions.execute();
  storage.failWrites = true;
  runtime.actions.confirmDone();
  assert.equal(runtime.screen.phase, "fork");
  assert.equal(runtime.state.log.length, 0);
  assert.equal(runtime.state.reporting.days["2026-09-22"].practiceEvents, 0);

  storage.failWrites = false;
  runtime.actions.confirmDone();
  assert.equal(runtime.screen.phase, "done");
  assert.equal(runtime.state.log.length, 1);
  assert.equal(runtime.state.reporting.days["2026-09-22"].practiceEvents, 1);
});

test("Node core compiles the same fresh daily session as the frozen engine", () => {
  const runtimeOptions = {
    htmlPath: "test/fixtures/wordbreak-legacy-v2.html",
    nowMs,
    uuidValues: [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ],
    randomValues: [17, 29, 43, 61],
  };
  const legacy = extractRuntime(root, runtimeOptions);
  legacy.actions.startSession(false);

  const generated = extractRuntime(root, { ...runtimeOptions, htmlPath: "wordbreak_v2.html" });
  generated.actions.startSession(false);
  assert.deepEqual(JSON.parse(JSON.stringify(generated.state)), JSON.parse(JSON.stringify(legacy.state)));
  assert.deepEqual(JSON.parse(JSON.stringify(generated.screen)), JSON.parse(JSON.stringify(legacy.screen)));

  const core = nodeCore({}, "00000000-0000-4000-8000-000000000002");
  const actual = commit(core, { type: "session.begin", budgetMin: 10 });
  assert.deepEqual(JSON.parse(actual.stateJson), JSON.parse(JSON.stringify(legacy.state)));
  assert.deepEqual(JSON.parse(JSON.stringify(actual.viewModel)), JSON.parse(JSON.stringify(legacy.screen)));
});
