import assert from "node:assert/strict";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { extractRuntime } from "../scripts/runtime-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("enabled field pack has fixed identity and joins the learner path only after core", () => {
  const data = extractRuntime(root);
  assert.deepEqual(JSON.parse(JSON.stringify(data.fieldPack)), {
    version: 1,
    on: true,
    ids: ["9.1", "9.2", "9.3", "9.4"],
  });
  assert.equal(data.units.filter(data.helpers.isPackUnit).length, 4);
  assert.equal(data.units.filter(data.helpers.isEnabledUnit).length, 52);
  assert.equal(data.helpers.isPackUnit({ id: "9.1" }), true);
  assert.equal(data.helpers.isEnabledUnit({ id: "9.1" }), true);
  assert.equal(data.helpers.isEnabledUnit({ id: "8.3" }), true);
  assert.equal(Object.hasOwn(data.state, "fieldPack"), false);
});

test("all-core-clear learner receives field pack 9.1 after reviews", () => {
  const data = extractRuntime(root);
  for (const unit of data.units.filter((unit) => !data.helpers.isPackUnit(unit))) data.state.cleared[unit.id] = true;
  const session = data.helpers.compileSession(10);
  assert.equal(session.blocks[0].k, "mod");
  assert.equal(session.blocks[0].id, "9.1");
});

test("disabling the pack hides and de-queues every pack path without erasing progress", () => {
  const data = extractRuntime(root, { fieldPackOn: false });
  data.state.cleared["9.1"] = true;
  data.state.docs["9.1"] = true;
  data.state.sched["9.1|political"] = { unit: "9.1", word: "political", due: 0 };
  data.state.session = { day: "2026-08-07", done: false, idx: 0, blocks: [{ k: "mod", id: "9.1" }] };
  assert.equal(data.helpers.isEnabledUnit(data.units.find((unit) => unit.id === "9.1")), false);
  assert.equal(data.helpers.dueList().some((entry) => entry.u.id === "9.1"), false);
  assert.equal(data.helpers.sessionValid(data.state.session), false);
  assert.equal(data.state.cleared["9.1"], true);
  assert.equal(data.state.docs["9.1"], true);
});

test("known v1 import survives with the feature enabled", () => {
  const data = extractRuntime(root);
  const imported = {
    docs: { "9.1": true },
    cleared: { "9.1": true },
    sched: { "9.1|example": { unit: "9.1", word: "example", due: 1 } },
    fieldPack: { version: 1, unitIds: ["9.1", "9.2", "9.3", "9.4"] },
  };
  const result = data.helpers.normalizeImportedProgress(imported, 123);
  assert.equal(result.ok, true);
  assert.equal(result.quarantined, undefined);
  assert.equal(result.state.cleared["9.1"], true);
  assert.equal(result.state.sched["9.1|example"].unit, "9.1");
});

test("unknown pack import is losslessly quarantined and terminalizes a mixed session once", () => {
  const data = extractRuntime(root);
  const imported = {
    docs: { "4.1": true, "10.1": true },
    cleared: { "4.1": true, "10.1": true },
    sched: {
      "4.1|core": { unit: "4.1", word: "core", due: 1 },
      "10.1|future": { unit: "10.1", word: "future", due: 1 },
    },
    session: {
      id: "mixed",
      status: "in_progress",
      revision: 1,
      blocks: [{ k: "mod", id: "4.2" }, { k: "mod", id: "10.1" }],
    },
    sessions: [{ id: "mixed", status: "in_progress", revision: 1, endedAt: null }],
    reporting: { days: { "2026-08-05": { modulesCleared: ["4.1", "10.1"] } } },
    fieldPack: { version: 2, unitIds: ["10.1"] },
  };
  const result = data.helpers.normalizeImportedProgress(imported, 456);
  assert.equal(result.ok, true);
  assert.equal(result.quarantined, true);
  assert.equal(result.state.session, null);
  assert.equal(result.state.sessions[0].status, "abandoned");
  assert.equal(result.state.sessions[0].endedAt, 456);
  assert.equal(result.state.sessions[0].reason, "unknown_pack_version");
  assert.equal(result.state.cleared["4.1"], true);
  assert.equal(result.state.cleared["10.1"], undefined);
  assert.equal(result.state.sched["4.1|core"].unit, "4.1");
  assert.equal(result.state.sched["10.1|future"], undefined);
  assert.deepEqual(Array.from(result.state.reporting.days["2026-08-05"].modulesCleared), ["4.1"]);
  const quarantine = result.state.quarantine.fieldPacks[0];
  assert.equal(quarantine.cleared["10.1"], true);
  assert.equal(quarantine.sched["10.1|future"].word, "future");
  assert.equal(quarantine.session.id, "mixed");
  assert.deepEqual(Array.from(quarantine.reportingModules["2026-08-05"]), ["10.1"]);
  assert.equal(Object.hasOwn(result.state, "fieldPack"), false);
});

test("a fifth unknown pack rejects the whole import instead of dropping data", () => {
  const data = extractRuntime(root);
  const imported = {
    fieldPack: { version: 9, unitIds: ["18.1"] },
    quarantine: { fieldPacks: Array.from({ length: 4 }, (_, version) => ({ version })) },
  };
  const result = data.helpers.normalizeImportedProgress(imported, 789);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    ok: false,
    error: "field_pack_quarantine_full",
  });
  assert.equal(imported.quarantine.fieldPacks.length, 4);
});

test("invalid descriptors fail closed before progress replacement", () => {
  const data = extractRuntime(root);
  for (const descriptor of [
    { version: 2, unitIds: [] },
    { version: 2, unitIds: ["future"] },
    { version: 2, unitIds: ["10.1", "10.1"] },
  ]) {
    assert.equal(data.helpers.normalizeImportedProgress({ fieldPack: descriptor }).ok, false);
  }
});
