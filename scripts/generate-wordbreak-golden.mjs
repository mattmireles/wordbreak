#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { extractRuntime } from "./runtime-data.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const fixtureRoot = resolve(root, "test/fixtures");
const goldenRoot = resolve(fixtureRoot, "wordbreak-golden");
const legacyPath = resolve(fixtureRoot, "wordbreak-legacy-v2.html");
const nowMs = Date.UTC(2026, 8, 22, 23, 0, 0);

function storageFor(state) {
  const values = new Map();
  if (state) values.set("wb2", JSON.stringify(state));
  return {
    values,
    failWrites: false,
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { if (this.failWrites) throw new Error("storage full"); this.values.set(key, value); },
    removeItem(key) { this.values.delete(key); },
  };
}

function runtime(state, extras = {}, htmlPath = "test/fixtures/wordbreak-legacy-v2.html") {
  return extractRuntime(root, {
    htmlPath,
    nowMs,
    storage: storageFor(state),
    uuidValues: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"],
    randomValues: [17, 29, 43, 61],
    confirm: () => true,
    ...extras,
  });
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function hotIndex(word) {
  if (word.hot.ix?.length) return word.hot.ix[0];
  const start = word.hot.m || 0;
  for (let index = start; index < word.a.length; index++) {
    const character = word.a[index].toLowerCase();
    if (word.hot.v && "aeiouy".includes(character) && !(index === word.a.length - 1 && character === "e")) return index;
    if (word.hot.c?.includes(character)) return index;
  }
  throw new Error(`No hot index for ${word.a}`);
}

function snapshot(data, label, sourceSha256) {
  return {
    label,
    sourceSha256,
    clock: { nowMs, timezoneOffsetMinutes: new Date(nowMs).getTimezoneOffset() },
    screen: clone(data.screen),
    state: clone(data.state),
  };
}

export function makeScenarios({ htmlPath = "test/fixtures/wordbreak-legacy-v2.html" } = {}) {
  const sourceSha256 = createHash("sha256").update(readFileSync(resolve(root, htmlPath))).digest("hex");
  const fresh = runtime(undefined, {}, htmlPath);
  const unit = fresh.units.find((candidate) => fresh.helpers.isEnabledUnit(candidate));
  const word = unit.words[0];

  fresh.state.docs[unit.id] = true;
  fresh.actions.openRun(unit.id);
  fresh.app.value = word.a;
  fresh.actions.commitTyped();
  fresh.actions.setFlag(hotIndex(word));
  fresh.actions.execute();
  fresh.actions.confirmDone();
  const correct = snapshot(fresh, "correct attempt with live aim", sourceSha256);

  const missRuntime = runtime(undefined, {}, htmlPath);
  missRuntime.state.docs[unit.id] = true;
  missRuntime.actions.openRun(unit.id);
  missRuntime.app.value = `${word.a}x`;
  missRuntime.actions.commitTyped();
  missRuntime.actions.setFlag(0);
  missRuntime.actions.execute();
  missRuntime.actions.toPatch();
  missRuntime.app.value = word.a;
  missRuntime.actions.commitPatch();
  const miss = snapshot(missRuntime, "miss then final production correction", sourceSha256);

  const reloaded = runtime(miss.state, {}, htmlPath);
  const reload = {
    ...snapshot(reloaded, "reload preserves committed correction", sourceSha256),
    derived: {
      dueCount: reloaded.helpers.dueList().length,
      resumableSession: reloaded.helpers.sessionValid(reloaded.state.session),
    },
  };

  const sessionRuntime = runtime(undefined, {}, htmlPath);
  const compiled = sessionRuntime.helpers.compileSession(10);
  sessionRuntime.state.session = compiled;
  sessionRuntime.state.sessions.push({
    id: compiled.id, day: compiled.day, startReportDay: compiled.startReportDay,
    status: "in_progress", revision: 1, bonus: false, budgetMin: 10,
    blocksTotal: compiled.blocks.length, doneBlocks: compiled.blocks.length,
    activeMs: 0, startedAt: compiled.startedAt, endedAt: null,
  });
  sessionRuntime.state.session.idx = sessionRuntime.state.session.blocks.length;
  sessionRuntime.actions.enterBlock();
  const sessionCompletion = snapshot(sessionRuntime, "session completion transition", sourceSha256);

  const assessmentRuntime = runtime(undefined, {}, htmlPath);
  const beforeAssessment = clone(assessmentRuntime.helpers.assessmentEligibility());
  assessmentRuntime.actions.startAssessment("baseline");
  const assessmentBoundaries = {
    ...snapshot(assessmentRuntime, "assessment boundary and frozen assignment", sourceSha256),
    derived: { beforeAssessment, phase: assessmentRuntime.helpers.assessmentPhase() },
  };

  const packRuntime = runtime(undefined, {}, htmlPath);
  const imported = clone(packRuntime.state);
  imported.fieldPack = { version: 99, unitIds: ["10.1"] };
  imported.docs["10.1"] = true;
  imported.cleared["10.1"] = true;
  imported.sched["10.1|future"] = { unit: "10.1", word: "future", due: 1 };
  const fieldPackTransitions = {
    label: "unknown field pack is losslessly quarantined",
    sourceSha256,
    result: clone(packRuntime.helpers.normalizeImportedProgress(imported, nowMs)),
    enabledPackIds: clone(packRuntime.fieldPack.ids),
  };

  return { correct, miss, reload, sessionCompletion, assessmentBoundaries, fieldPackTransitions };
}

function serialized(scenarios) {
  return Object.fromEntries(Object.entries(scenarios).map(([name, value]) => [name, `${JSON.stringify(value, null, 2)}\n`]));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sourceSha256 = createHash("sha256").update(readFileSync(legacyPath)).digest("hex");
  const outputs = serialized(makeScenarios());
  const repeat = serialized(makeScenarios());
  if (JSON.stringify(outputs) !== JSON.stringify(repeat)) throw new Error("Golden fixture generation is not repeatable");

  if (process.argv.includes("--check")) {
    for (const [name, text] of Object.entries(outputs)) {
      const path = resolve(goldenRoot, `${name}.json`);
      if (readFileSync(path, "utf8") !== text) throw new Error(`Stale golden fixture: ${name}.json`);
    }
    console.log(`Verified ${Object.keys(outputs).length} repeatable Wordbreak golden fixtures from ${sourceSha256}.`);
  } else {
    mkdirSync(goldenRoot, { recursive: true });
    for (const [name, text] of Object.entries(outputs)) writeFileSync(resolve(goldenRoot, `${name}.json`), text);
    writeFileSync(resolve(goldenRoot, "index.json"), `${JSON.stringify({ schemaVersion: 1, sourceSha256, scenarios: Object.keys(outputs) }, null, 2)}\n`);
    console.log(`Generated ${Object.keys(outputs).length} repeatable Wordbreak golden fixtures from ${sourceSha256}.`);
  }
}
