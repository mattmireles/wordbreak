import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

/*
 * Synthetic worst-case native daily session (Plan 007 Phase 2).
 *
 * The native shell asks Wordbreak for a 6-minute block (DailySessionContract.swift) and then
 * runs one Mathbreak queue. A started Wordbreak module and an active Mathbreak correction are
 * atomic, so the day can overshoot the 12-minute soft target. This test drives the real
 * authored engines through the largest day each one can plan and pins the resulting work, so a
 * curriculum or selection change that lengthens the day fails here before it reaches Luca.
 *
 * Wordbreak seconds come from the engine's own planning constants (SEC_PANEL 30, SEC_WORD 90).
 * Mathbreak has no engine duration constant, so the estimate charges an assumed 15 s per single
 * placement answer and the Wordbreak SEC_WORD (90 s) per practice item, because every practice
 * item forces attempt -> strategy construction -> retype. These are planning estimates, not
 * device timings: the app promises Luca no duration until Luca-device timing exists.
 */

const SEC_PANEL = 30;
const SEC_WORD = 90;
const SEC_REV = 60;
const ASSUMED_SEC_MATH_PLACEMENT = 15;
const ASSUMED_SEC_MATH_PRACTICE = SEC_WORD;
const WORDBREAK_BUDGET_MIN = 6;
const SOFT_TARGET_MIN = 12;

function loadEngines() {
  const context = {};
  context.globalThis = context;
  for (const file of ["wordbreak-content.js", "wordbreak-core.js", "mathbreak-core.js"]) {
    runInNewContext(readFileSync(new URL(`game/${file}`, import.meta.url), "utf8"), context, { filename: file });
  }
  return {
    WordbreakCore: context.WordbreakCore,
    MathbreakCore: context.MathbreakCore,
    wordContent: context.createWordbreakContent(2),
    mathContent: JSON.parse(readFileSync(new URL("game/mathbreak-content.json", import.meta.url), "utf8")),
  };
}

const nowMs = Date.UTC(2026, 8, 25, 23, 0, 0);
const today = Math.floor(nowMs / 86_400_000);

function worstWordbreakDay({ WordbreakCore, wordContent }) {
  let worst = null;
  const units = wordContent.UNITS;
  for (let index = 0; index < units.length; index++) {
    // Every earlier unit is cleared with an overdue review backlog; this unit is unread.
    const cleared = {};
    const docs = {};
    const sched = {};
    for (const prior of units.slice(0, index)) {
      cleared[prior.id] = true;
      docs[prior.id] = true;
      for (const word of prior.words) {
        const key = `${prior.id}|${word.a.toLowerCase()}`;
        sched[key] = { box: 1, due: today - 1, lapses: 2, last: today - 3, seen: 2, unit: prior.id, word: word.a.toLowerCase() };
      }
    }
    const core = WordbreakCore.create({
      stateJson: JSON.stringify({ cleared, docs, sched }),
      content: wordContent,
      nowMs,
      timezoneOffsetMinutes: 420,
      random: () => 0.25,
      uuid: () => "00000000-0000-4000-8000-000000000007",
    });
    const session = JSON.parse(core.dispatch({ type: "session.begin", budgetMin: WORDBREAK_BUDGET_MIN }).stateJson).session;
    let seconds = 0;
    let opportunities = 0;
    for (const block of session.blocks) {
      if (block.k === "mod") {
        seconds += block.pc * SEC_PANEL + (block.cells - block.pc) * SEC_WORD;
        opportunities += block.cells - block.pc;
      } else {
        seconds += SEC_REV;
        opportunities++;
      }
    }
    const first = session.blocks[0];
    if (!worst || seconds > worst.seconds) {
      worst = { unitId: units[index].id, first, seconds, opportunities, blockCount: session.blocks.length };
    }
  }
  return worst;
}

function driveWorstMathDay({ MathbreakCore, mathContent }) {
  const core = MathbreakCore.create({
    stateJson: "{}",
    content: mathContent,
    nowMs,
    timezoneOffsetMinutes: 420,
    random: () => 0.25,
  });
  const step = (action) => {
    const output = core.dispatch(action);
    core.accept(output.stateJson);
    return output.viewModel;
  };
  const counts = { placement: 0, practice: 0, wrongFirstAnswers: 0, strategyCorrections: 0 };
  let view = step({ type: "session.begin" });
  while (view.screen !== "mathDone") {
    const item = view.item;
    if (view.screen === "mathPlacement") {
      // A wrong placement answer is the slowest honest path; it does not lengthen the screen.
      counts.placement++;
      view = step({ type: "answer.submit", answer: item.answer + 1, latencyMs: 0 });
      continue;
    }
    counts.practice++;
    view = step({ type: "answer.submit", answer: item.answer + 1, latencyMs: 0 });
    counts.wrongFirstAnswers++;
    for (const choice of view.strategyChoices) {
      view = step({ type: "strategy.select", choiceId: choice.id });
      if (view.phase === "retype") break;
      counts.strategyCorrections++;
    }
    assert.equal(view.phase, "retype");
    view = step({ type: "answer.retype", answer: item.answer });
  }
  return counts;
}

test("the synthetic worst-case day keeps both subjects' minimum work and pins its planned duration", () => {
  const engines = loadEngines();
  const word = worstWordbreakDay(engines);
  const math = driveWorstMathDay(engines);

  // Wordbreak: an unread, non-fast-pass module is atomic even though it exceeds the 6-minute block.
  assert.equal(word.first.k, "mod");
  assert.ok(word.first.pc > 0, "worst case must include unread lesson panels");
  assert.ok(word.opportunities >= 4, "Wordbreak keeps at least four production opportunities");
  assert.equal(word.seconds, 480);

  // Mathbreak: the first day adds the full broad screener and one lane probe to a corrected queue.
  assert.equal(math.placement, 30);
  assert.ok(math.practice >= 4, "Mathbreak keeps at least four production opportunities");
  assert.equal(math.practice, 6);

  const firstDaySeconds = word.seconds
    + math.placement * ASSUMED_SEC_MATH_PLACEMENT
    + math.practice * ASSUMED_SEC_MATH_PRACTICE;
  const ordinaryDaySeconds = word.seconds + math.practice * ASSUMED_SEC_MATH_PRACTICE;
  assert.equal(firstDaySeconds, 1470);
  assert.equal(ordinaryDaySeconds, 1020);
  assert.equal(ordinaryDaySeconds - SOFT_TARGET_MIN * 60, 300, "ordinary worst case overshoots the soft target by 5 minutes");
});
