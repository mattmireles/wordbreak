import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("game/wordbreak-core.js", import.meta.url), "utf8");

function loadCore() {
  const context = {};
  context.globalThis = context;
  runInNewContext(source, context, { filename: "wordbreak-core.js" });
  return context.WordbreakCore;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function create(overrides = {}) {
  return loadCore().create({
    stateJson: JSON.stringify({ futureField: { retained: true }, z: 1 }),
    content: {
      units: [{
        id: "1.1", st: 1, err: "E7", nm: "intro", docs: [{}],
        words: [{ a: "sunset", hot: { c: "ns", m: 2 }, fork: { k: "cond", qs: [] } }],
      }],
    },
    nowMs: Date.UTC(2026, 8, 25, 23, 0, 0),
    timezoneOffsetMinutes: 420,
    random: () => 0.25,
    uuid: () => "00000000-0000-4000-8000-000000000001",
    ...overrides,
  });
}

test("core round-trips unknown progress fields as canonical JSON", () => {
  const core = create();
  const output = core.dispatch({ type: "state.read" });
  assert.equal(JSON.parse(output.stateJson).futureField.retained, true);
  assert.equal(JSON.parse(output.stateJson).z, 1);
  assert.deepEqual(plain(output.effects), []);
  assert.deepEqual(plain(output.semanticEvents), []);
});

test("session transitions use only injected clock and UUID values", () => {
  const core = create();
  const started = core.dispatch({ type: "session.begin", budgetMin: 10 });
  assert.equal(started.viewModel.screen, "docs");
  assert.deepEqual(plain(started.semanticEvents), [{
    type: "session.started",
    sessionId: "00000000-0000-4000-8000-000000000001",
    atMs: Date.UTC(2026, 8, 25, 23, 0, 0),
    budgetMin: 10,
  }]);
  assert.equal(JSON.parse(started.stateJson).futureField.retained, true);
  core.accept(started.stateJson);

  const completed = core.dispatch({ type: "session.complete" });
  assert.equal(completed.viewModel.screen, "sessionDone");
  assert.equal(JSON.parse(completed.stateJson).session.status, "completed");
});

test("an unacknowledged action remains exactly retryable after host storage failure", () => {
  const core = create();
  const first = core.dispatch({ type: "session.begin", budgetMin: 10 });
  core.discard();
  const retry = core.dispatch({ type: "session.begin", budgetMin: 10 });
  assert.equal(retry.stateJson, first.stateJson);
  assert.deepEqual(plain(retry.semanticEvents), plain(first.semanticEvents));
  assert.equal(JSON.parse(core.stateJson()).session, null);
});

test("the core accepts only the exact state bytes returned by dispatch", () => {
  const core = create();
  const output = core.dispatch({ type: "session.begin" });
  assert.throws(() => core.accept(`${output.stateJson} `), /exact pending state/);
  core.accept(output.stateJson);
  assert.equal(JSON.parse(core.stateJson()).session.status, "in_progress");
});

test("core rejects ambient or malformed inputs instead of guessing", () => {
  const WordbreakCore = loadCore();
  assert.throws(() => WordbreakCore.create({
    stateJson: "[]",
    content: {},
    nowMs: 0,
    timezoneOffsetMinutes: 0,
    random: () => 0,
    uuid: () => "id",
  }), /object/);
  assert.throws(() => create().dispatch({ type: "mystery" }), /Unknown Wordbreak action/);
});

test("native lesson actions advance docs, words, and finish the session", () => {
  const core = create();
  let output = core.dispatch({ type: "session.begin", budgetMin: 1 });
  core.accept(output.stateJson);
  assert.equal(output.viewModel.screen, "docs");

  output = core.dispatch({ type: "docs.complete" });
  core.accept(output.stateJson);
  assert.equal(output.viewModel.screen, "run");

  output = core.dispatch({ type: "word.commitTyped", value: "sunset" });
  core.accept(output.stateJson);
  output = core.dispatch({ type: "word.setFlag", index: 2 });
  core.accept(output.stateJson);
  output = core.dispatch({ type: "word.execute" });
  core.accept(output.stateJson);
  output = core.dispatch({ type: "word.confirmDone" });
  core.accept(output.stateJson);
  output = core.dispatch({ type: "word.advance" });
  core.accept(output.stateJson);
  assert.equal(output.viewModel.screen, "sessionDone");
  assert.equal(JSON.parse(output.stateJson).session.status, "completed");

  output = core.dispatch({ type: "session.begin", budgetMin: 1 });
  assert.equal(output.viewModel.screen, "sessionDone");
  assert.equal(JSON.parse(output.stateJson).sessions.length, 1);
});

test("a fully taught learner still receives four daily reconstruction opportunities", () => {
  const words = ["sunset", "rabbit", "picnic", "hoping"].map((answer, index) => ({
    a: answer,
    hot: { c: answer[index], m: index },
    fork: { k: "cond", qs: [] },
  }));
  const nowMs = Date.UTC(2026, 8, 25, 23, 0, 0);
  const state = {
    cleared: { "1.1": true },
    docs: { "1.1": true },
    sched: Object.fromEntries(words.map((word, index) => [`1.1|${word.a}`, {
      box: 4,
      due: Math.floor(nowMs / 86_400_000) + 30 + index,
      lapses: index,
      last: Math.floor(nowMs / 86_400_000) - 1,
      seen: 3,
      unit: "1.1",
      word: word.a,
    }])),
  };
  const core = create({
    stateJson: JSON.stringify(state),
    content: { units: [{ id: "1.1", st: 1, err: "E7", nm: "intro", docs: [{}], words }] },
  });

  const output = core.dispatch({ type: "session.begin", budgetMin: 6 });
  const session = JSON.parse(output.stateJson).session;
  assert.equal(session.blocks.length, 4);
  assert.ok(session.blocks.every((block) => block.k === "rev" && block.early === true));
  assert.equal(output.viewModel.screen, "run");
  assert.equal(output.viewModel.mode, "review");
});
