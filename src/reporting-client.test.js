import assert from "node:assert/strict";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { extractRuntime } from "../scripts/runtime-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("daily reporting mutations are revisioned and contain aggregates only", () => {
  const data = extractRuntime(root);
  const day = data.helpers.reportDay();
  const beforeSource = data.state.reporting.sourceRevision;
  const beforeDay = data.state.reporting.days[day].revision;
  data.helpers.reportAdd(day, "practiceEvents", 2);
  data.helpers.reportAdd(day, "clean", 1);
  data.helpers.reportAdd(day, "liveAim", 1);
  assert.equal(data.state.reporting.sourceRevision, beforeSource + 3);
  assert.equal(data.state.reporting.days[day].revision, beforeDay + 3);
  assert.equal(data.state.reporting.days[day].practiceEvents, 2);
  const serialized = JSON.stringify(data.helpers.reportState());
  assert.doesNotMatch(serialized, /response|target|spelling|assessment/i);
});

test("one terminal nonbonus session updates history, reporting, and durable assessment context once", () => {
  const data = extractRuntime(root);
  const day = data.helpers.reportDay();
  data.state.session = {
    id: "session-one", day: "2026-08-05", startReportDay: day, status: "in_progress",
    revision: 1, bonus: false, budgetMin: 30, blocks: [{ k: "mod", id: "4.1" }],
    idx: 0, activeMs: 0, startedAt: Date.now(), endedAt: null,
  };
  const completedBefore = data.state.assessment.nonbonusCompletedTotal;
  data.helpers.recordSessionStart();
  data.helpers.recordSessionEnd("completed");
  data.helpers.recordSessionEnd("completed");
  const row = data.state.sessions.at(-1);
  assert.equal(row.status, "completed");
  assert.ok(Number.isFinite(row.endedAt));
  assert.equal(data.state.reporting.days[day].sessionsStarted, 1);
  assert.equal(data.state.reporting.days[day].sessionsCompleted, 1);
  assert.equal(data.state.assessment.nonbonusCompletedTotal, completedBefore + 1);
});

test("abandoned and bonus terminal transitions update only their declared counters", () => {
  const abandoned = extractRuntime(root);
  const abandonedDay = abandoned.helpers.reportDay();
  abandoned.state.session = {
    id: "abandoned", day: "2026-08-05", startReportDay: abandonedDay, status: "in_progress",
    revision: 1, bonus: false, budgetMin: 30, blocks: [{ k: "mod", id: "4.1" }],
    idx: 0, activeMs: 0, startedAt: Date.now(), endedAt: null,
  };
  abandoned.helpers.recordSessionStart();
  abandoned.helpers.recordSessionEnd("abandoned");
  abandoned.helpers.recordSessionEnd("completed");
  assert.equal(abandoned.state.reporting.days[abandonedDay].sessionsAbandoned, 1);
  assert.equal(abandoned.state.reporting.days[abandonedDay].sessionsCompleted, 0);
  assert.equal(abandoned.state.assessment.nonbonusCompletedTotal, 0);

  const bonus = extractRuntime(root);
  const bonusDay = bonus.helpers.reportDay();
  bonus.state.session = {
    id: "bonus", day: "2026-08-05", startReportDay: bonusDay, status: "in_progress",
    revision: 1, bonus: true, budgetMin: 30, blocks: [{ k: "rev", key: "4.1|word" }],
    idx: 0, activeMs: 0, startedAt: Date.now(), endedAt: null,
  };
  bonus.helpers.recordSessionStart();
  bonus.helpers.recordSessionEnd("completed");
  assert.equal(bonus.state.reporting.days[bonusDay].bonusStarted, 1);
  assert.equal(bonus.state.reporting.days[bonusDay].bonusCompleted, 1);
  assert.equal(bonus.state.reporting.days[bonusDay].sessionsCompleted, 0);
  assert.equal(bonus.state.assessment.nonbonusCompletedTotal, 0);
});

test("active-time credit lands in the daily aggregate and current session row", () => {
  const data = extractRuntime(root);
  const day = data.helpers.reportDay();
  data.state.session = { id: "timed", activeMs: 0 };
  data.state.sessions.push({ id: "timed", activeMs: 0 });
  const end = performance.now();
  data.helpers.reportCredit(end - 1250, end);
  assert.equal(data.state.reporting.days[day].activeMs, 1250);
  assert.equal(data.state.session.activeMs, 1250);
  assert.equal(data.state.sessions.at(-1).activeMs, 1250);
});

test("active sampler credits only an active learner screen and caps one sample at five seconds", () => {
  const data = extractRuntime(root);
  const day = data.helpers.reportDay();
  data.state.session = { id: "sampled", activeMs: 0 };
  data.state.sessions.push({ id: "sampled", activeMs: 0 });
  data.screen.session = true;
  data.screen.screen = "run";
  const now = performance.now();
  data.helpers.setReportClockForTest(now, now - 20_000);
  data.helpers.reportSample(false);
  assert.equal(data.state.reporting.days[day].activeMs, 5000);
  data.screen.screen = "home";
  const later = performance.now();
  data.helpers.setReportClockForTest(later, later - 4000);
  data.helpers.reportSample(false);
  assert.equal(data.state.reporting.days[day].activeMs, 5000);
});

test("active sampler rejects hidden, idle, observer, and sessionless time", () => {
  const cases = [
    { screen: "run", sessionScreen: true, hidden: true, idleMs: 0 },
    { screen: "run", sessionScreen: true, hidden: false, idleMs: 30_001 },
    { screen: "debrief", sessionScreen: true, hidden: false, idleMs: 0 },
    { screen: "run", sessionScreen: false, hidden: false, idleMs: 0 },
  ];
  for (const fixture of cases) {
    const data = extractRuntime(root);
    const day = data.helpers.reportDay();
    data.state.session = { id: "not-active", activeMs: 0 };
    data.state.sessions.push({ id: "not-active", activeMs: 0 });
    data.screen.session = fixture.sessionScreen;
    data.screen.screen = fixture.screen;
    data.helpers.setDocumentHiddenForTest(fixture.hidden);
    const now = performance.now();
    data.helpers.setReportClockForTest(now - fixture.idleMs, now - 4000);
    data.helpers.reportSample(true);
    assert.equal(data.state.reporting.days[day].activeMs, 0, JSON.stringify(fixture));
  }
});

test("activity re-arms sampling and pagehide flushes only the bounded final slice", () => {
  const data = extractRuntime(root);
  const day = data.helpers.reportDay();
  data.state.session = { id: "pagehide", activeMs: 0 };
  data.state.sessions.push({ id: "pagehide", activeMs: 0 });
  data.screen.session = true;
  data.screen.screen = "docs";
  data.helpers.reportActivity();
  const now = performance.now();
  data.helpers.setReportClockForTest(now, now - 8500);
  data.helpers.reportPagehide();
  assert.equal(data.state.reporting.days[day].activeMs, 5000);
  assert.equal(data.state.session.activeMs, 5000);
});

test("dirty-day acknowledgement and coverage checkpoint remain explicit", () => {
  const data = extractRuntime(root);
  const day = data.helpers.reportDay();
  data.helpers.reportAdd(day, "practiceEvents", 1);
  assert.equal(data.helpers.reportDirty().some((bucket) => bucket.day === day), true);
  data.state.reporting.acked[day] = data.state.reporting.days[day].revision;
  assert.equal(data.helpers.reportDirty().some((bucket) => bucket.day === day), false);
  const checkpoint = data.helpers.reportCheckpoint();
  assert.equal(typeof checkpoint.earliestCompleteDay, "string");
  assert.ok(Array.isArray(checkpoint.gaps));
});

test("retention pressure records a visible gap instead of inventing zero activity", () => {
  const data = extractRuntime(root);
  const huge = "x".repeat(140_000);
  data.state.reporting.days["2026-01-01"] = {
    ...data.state.reporting.days[data.helpers.reportDay()],
    day: "2026-01-01", revision: 1, oversizedTestOnly: huge,
  };
  data.helpers.reportCompact();
  assert.equal(data.state.reporting.days["2026-01-01"], undefined);
  assert.equal(data.state.reporting.gaps.some((gap) => gap.start === "2026-01-01" && gap.reason === "local_storage_limit"), true);
});
