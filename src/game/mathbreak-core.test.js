import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("mathbreak-core.js", import.meta.url), "utf8");
const content = JSON.parse(readFileSync(new URL("mathbreak-content.json", import.meta.url), "utf8"));

function create(state = {}, options = {}) {
  const context = {};
  context.globalThis = context;
  runInNewContext(source, context, { filename: "mathbreak-core.js" });
  return context.MathbreakCore.create({
    stateJson: JSON.stringify(state),
    content,
    nowMs: options.nowMs ?? 1_790_118_000_000,
    timezoneOffsetMinutes: options.timezoneOffsetMinutes ?? 0,
    random: () => 0.25,
  });
}

function commit(core, action) {
  const output = core.dispatch(action);
  core.accept(output.stateJson);
  return output;
}

test("screener chooses a broad lane from correctness, not speed", () => {
  const core = create({ future: { retained: true } });
  let output = commit(core, { type: "session.begin" });
  assert.equal(output.viewModel.stage, "screener");
  for (const item of content.broadScreener) {
    const answer = item.lane === "multiplication" ? item.answer + 1 : item.answer;
    output = commit(core, { type: "answer.submit", answer, latencyMs: item.lane === "multiplication" ? 1 : 999_999 });
  }
  assert.equal(output.viewModel.stage, "probe");
  assert.equal(output.viewModel.lane, "multiplication");
  assert.equal(JSON.parse(output.stateJson).future.retained, true);
});

test("fixed probe assigns a weak family and requires an equivalent construction", () => {
  const core = create({
    placement: { phase: "probe", cursor: 0, responses: [], lane: "addition" },
  });
  let output;
  for (const item of content.laneProbes.addition) {
    const answer = item.factFamily === "bridge-ten" ? item.answer + 1 : item.answer;
    output = commit(core, { type: "answer.submit", answer, latencyMs: 100 });
  }
  assert.equal(output.viewModel.screen, "mathPractice");
  assert.equal(JSON.parse(output.stateJson).placement.family, "bridge-ten");

  output = commit(core, { type: "answer.submit", answer: output.viewModel.item.answer - 1, latencyMs: 100 });
  assert.equal(output.viewModel.phase, "bridge");
  output = commit(core, { type: "strategy.select", choiceId: "off-by-one" });
  assert.equal(output.viewModel.phase, "bridge");
  output = commit(core, { type: "strategy.select", choiceId: "equivalent" });
  assert.equal(output.viewModel.phase, "retype");
  output = commit(core, { type: "answer.retype", answer: output.viewModel.item.answer });
  assert.equal(output.viewModel.phase, "attempt");
});

test("practice schedules the target again after at least three intervening items", () => {
  const core = create({
    placement: {
      phase: "complete",
      cursor: 6,
      responses: [],
      lane: "multiplication",
      family: "six-eight",
      strategyId: "distribute",
    },
  });
  const started = commit(core, { type: "session.begin" });
  const queue = JSON.parse(started.stateJson).practice.queue;
  assert.equal(queue.at(-1).id, queue[0].id);
  assert.equal(queue.at(-1).retrieval, true);
  assert.ok(queue.length - 2 >= content.delayedRetrieval.minimumInterveningItems);
});

test("unacknowledged math actions are exactly retryable", () => {
  const core = create();
  const first = core.dispatch({ type: "session.begin" });
  core.discard();
  const retry = core.dispatch({ type: "session.begin" });
  assert.equal(retry.stateJson, first.stateJson);
  assert.deepEqual(JSON.parse(JSON.stringify(retry.viewModel)), JSON.parse(JSON.stringify(first.viewModel)));
});

test("completed math practice restarts on the next local day but not twice today", () => {
  const nowMs = Date.UTC(2026, 8, 25, 20);
  const today = Math.floor(nowMs / 86_400_000);
  const state = {
    placement: {
      phase: "complete",
      cursor: 6,
      responses: [],
      lane: "addition",
      family: "bridge-ten",
      strategyId: "make-ten",
    },
    practice: { day: today, done: true, cursor: 0, queue: [], phase: "attempt" },
  };
  const sameDay = commit(create(state, { nowMs }), { type: "session.begin" });
  assert.equal(sameDay.viewModel.screen, "mathDone");

  const nextDay = commit(create(state, { nowMs: nowMs + 86_400_000 }), { type: "session.begin" });
  assert.equal(nextDay.viewModel.screen, "mathPractice");
  assert.equal(JSON.parse(nextDay.stateJson).practice.day, today + 1);
});

test("math events carry the per-action host clock", () => {
  const start = 1_790_118_000_000;
  const core = create({}, { nowMs: start });
  const begun = core.dispatch({ type: "session.begin", nowMs: start + 1_000 });
  assert.equal(begun.semanticEvents[0].atMs, start + 1_000);
  assert.throws(() => core.dispatch({ type: "state.read", nowMs: "soon" }), /finite/);
});
