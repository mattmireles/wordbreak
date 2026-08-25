import test from "node:test";
import assert from "node:assert/strict";
import { canonical, isMonotonic, normalizeDay, reportDay } from "./reporting.js";
import { buildReportModel, renderReport } from "./report.js";

const empty = {
  day: "2026-08-05", revision: 1, activeMs: 0, practiceEvents: 0,
  clean: 0, liveAim: 0, reviewEvents: 0, reviewClean: 0,
  reviewLiveAim: 0, sessionsStarted: 0, sessionsCompleted: 0,
  sessionsAbandoned: 0, bonusStarted: 0, bonusCompleted: 0,
  modulesCleared: [], codes: {},
};

test("canonical JSON sorts nested keys", () => {
  assert.equal(canonical({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}');
});

test("daily aggregate validation and monotonic replacement", () => {
  const next = normalizeDay({ ...empty, revision: 2, practiceEvents: 2, clean: 1, modulesCleared: ["1.1"], codes: { E1: { seen: 2, clean: 1, aim: 1 } } });
  const prior = { ...Object.fromEntries(Object.entries(empty).filter(([k]) => !["day", "revision", "modulesCleared", "codes"].includes(k)).map(([k, v]) => [k.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`), v])), modules_json: "[]", codes_json: "{}" };
  assert.equal(isMonotonic(next, prior), true);
  assert.equal(isMonotonic({ ...next, practiceEvents: 0 }, { ...prior, practice_events: 1 }), false);
});

test("numeric field-pack clears remain valid and monotonic with the rest of the day", () => {
  const first = normalizeDay({ ...empty, revision: 1, practiceEvents: 1, clean: 1, liveAim: 1,
    modulesCleared: ["9.1"], codes: { E1: { seen: 1, clean: 1, aim: 1 } } });
  assert.deepEqual(first.modulesCleared, ["9.1"]);
  const prior = {
    active_ms: 0, practice_events: 1, clean: 1, live_aim: 1, review_events: 0,
    review_clean: 0, review_live_aim: 0, sessions_started: 0, sessions_completed: 0,
    sessions_abandoned: 0, bonus_started: 0, bonus_completed: 0,
    modules_json: '["9.1"]', codes_json: '{"E1":{"seen":1,"clean":1,"aim":1}}',
  };
  const next = normalizeDay({ ...empty, revision: 2, practiceEvents: 2, clean: 1, liveAim: 1,
    modulesCleared: ["4.1", "9.1"], codes: { E1: { seen: 2, clean: 1, aim: 1 } } });
  assert.equal(isMonotonic(next, prior), true);
  assert.equal(isMonotonic({ ...next, modulesCleared: ["4.1"] }, prior), false);
});

test("Los Angeles report day is fixed across UTC midnight", () => {
  assert.equal(reportDay(Date.parse("2026-08-06T02:00:00Z")), "2026-08-05");
});

test("incomplete report uses lower bounds and withholds rates", () => {
  const row = { active_ms: 60000, practice_events: 8, clean: 7, live_aim: 6, review_events: 2, review_clean: 2, sessions_started: 1, sessions_completed: 1, sessions_abandoned: 0, bonus_started: 0, bonus_completed: 0 };
  const model = buildReportModel([row], { complete_through_day: null, gaps_json: "[]", last_complete_sync_at: null }, "2026-07-27", "2026-08-03");
  const rendered = renderReport(model);
  assert.match(rendered.text, /At least 8 spelling attempts/);
  assert.match(rendered.text, /Rates withheld/);
  assert.doesNotMatch(rendered.subject, /Luca|spelling attempts/);
});
