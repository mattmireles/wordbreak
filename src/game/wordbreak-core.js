"use strict";

(function installWordbreakCore(root) {
  const STATE_VERSION = 1;
  const ASSESSMENT_VERSION = 2;
  const CFG_VERSION = 3;
  const DEFAULT_SESSION_MIN = 10;
  const LOG_CAP = 500;
  const DAY_MS = 86_400_000;
  const BOX_DAYS = [1, 3, 9, 21, 45];
  const LAMBDA = 0.92;
  const VOWELS = "aeiou";
  const FIELD_PACK_VERSION = 1;
  const FIELD_PACK_IDS = ["9.1", "9.2", "9.3", "9.4"];
  const SESSION_QUEUE_VERSION = 2;
  const SEC_REV = 60;
  const SEC_PANEL = 30;
  const SEC_WORD = 90;
  const REVIEW_BLOCKS_PER_SESSION = 4;
  const MIN_PRODUCTION_OPPORTUNITIES = 4;
  const ERR_WEIGHT = { E11: 6, E1: 5, E2: 5, E5: 4, E8: 4, E7: 3, E10: 3, E9: 3, E6: 2, E4: 2, E3: 1, E0: 0 };

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function parseState(stateJson) {
    if (stateJson === undefined || stateJson === null || stateJson === "") return {};
    if (typeof stateJson !== "string") throw new TypeError("stateJson must be a JSON string");
    const parsed = JSON.parse(stateJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("stateJson must encode an object");
    }
    return parsed;
  }

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== "object") return value;
    const output = {};
    for (const key of Object.keys(value).sort()) output[key] = canonicalize(value[key]);
    return output;
  }

  function serialize(state) {
    return JSON.stringify(canonicalize(state));
  }

  function dayNumber(nowMs, timezoneOffsetMinutes) {
    return Math.floor((nowMs - timezoneOffsetMinutes * 60_000) / DAY_MS);
  }

  function reportDay(nowMs, timezoneOffsetMinutes) {
    const local = new Date(nowMs - timezoneOffsetMinutes * 60_000);
    const year = local.getUTCFullYear();
    const month = String(local.getUTCMonth() + 1).padStart(2, "0");
    const day = String(local.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function freshAssessment(completed) {
    return { version: ASSESSMENT_VERSION, assignment: null, runs: [], nonbonusCompletedTotal: completed || 0 };
  }

  function emptyReport(day) {
    return {
      day, revision: 0, activeMs: 0, practiceEvents: 0, clean: 0, liveAim: 0,
      reviewEvents: 0, reviewClean: 0, reviewLiveAim: 0, sessionsStarted: 0,
      sessionsCompleted: 0, sessionsAbandoned: 0, bonusStarted: 0,
      bonusCompleted: 0, modulesCleared: [], codes: {},
    };
  }

  function initialScreen() {
    return {
      screen: "home", openStage: null, unit: null, docsIdx: 0, ketsuPick: null,
      ketsuTyped: false, mode: "module", queue: [], qIdx: 0, wordIdx: 0,
      phase: "type", typed: "", flagIdx: null, aimGood: false,
      firstClean: false, walkAnyway: false, condQ: 0, condPicks: {},
      lineupSpent: {}, witnessFound: false, memPhase: "study", patchTries: 0,
      reveal: false, log: [], runGen: 0, tShown: 0, latency: null,
      fastPass: false, fastCleared: false, session: false, docsReadOnly: false,
      assessmentAudioBusy: false, assessmentPagehideRecorded: false,
    };
  }

  function gradeEncounter(event) {
    if (event.clean) return event.aim ? 0.92 : 0.80;
    let score = event.aim ? 0.30 : 0.15;
    if (event.aim && (event.tries || 0) <= 1 && !event.revealed) score += 0.10;
    if (event.revealed) score -= 0.07;
    return Math.max(0, Math.min(1, score));
  }

  function updateCode(state, code, score) {
    if (!code || code === "E0") return;
    const profile = state.codes[code] || { a: 1, b: 1, seen: 0 };
    profile.a = profile.a * LAMBDA + score;
    profile.b = profile.b * LAMBDA + (1 - score);
    profile.seen++;
    state.codes[code] = profile;
  }

  function normalizeState(input, nowMs, timezoneOffsetMinutes) {
    const state = clone(input);
    state.docs ||= {};
    state.cleared ||= {};
    state.log = Array.isArray(state.log) ? state.log.slice(-LOG_CAP) : [];
    state.cfg ||= { budgetMin: DEFAULT_SESSION_MIN, v: CFG_VERSION };
    if ((state.cfg.v || 0) < CFG_VERSION) {
      if (state.cfg.budgetMin === 30) state.cfg.budgetMin = DEFAULT_SESSION_MIN;
      state.cfg.v = CFG_VERSION;
    }
    state.session ||= null;
    state.sessions = Array.isArray(state.sessions) ? state.sessions : [];
    state.reporting ||= { version: 1, sourceRevision: 0, days: {}, acked: {}, gaps: [], deadLetters: [], legacy: null };
    state.reporting.days ||= {};
    state.reporting.acked ||= {};
    state.reporting.gaps ||= [];
    state.reporting.deadLetters ||= [];
    if (!("legacy" in state.reporting)) state.reporting.legacy = null;
    const completed = state.sessions.filter((entry) => !entry.bonus && entry.status === "completed").length;
    if (!state.assessment || state.assessment.version !== ASSESSMENT_VERSION || !Array.isArray(state.assessment.runs)) {
      const hadAssessment = Boolean(state.assessment);
      state.assessment = freshAssessment(completed);
      if (hadAssessment) {
        state.assessment.runs.push({
          id: `quarantined-${nowMs}`, status: "corrupt_noncomparable", role: "unknown",
          comparable: false, reasons: ["invalid persisted assessment shape"],
          startedAt: nowMs, completedAt: null, responses: [],
        });
      }
    }
    state.assessment.nonbonusCompletedTotal = Math.max(Number(state.assessment.nonbonusCompletedTotal) || 0, completed);
    const day = reportDay(nowMs, timezoneOffsetMinutes);
    if (!state.reporting.days[day]) {
      state.reporting.days[day] = emptyReport(day);
      state.reporting.days[day].revision++;
      state.reporting.sourceRevision++;
    }
    state.sched ||= {};
    state.codes ||= {};
    state.codesV ||= 0;
    if (state.codesV < 1) {
      for (const event of state.log) updateCode(state, event.err, gradeEncounter(event));
      state.codesV = 1;
    }
    return state;
  }

  function reportTouch(state, day) {
    const report = state.reporting.days[day] || (state.reporting.days[day] = emptyReport(day));
    state.reporting.sourceRevision++;
    report.revision++;
    return report;
  }

  function isHot(word, typed, index) {
    const hot = word.hot;
    const character = (typed[index] || "").toLowerCase();
    if (!character) return false;
    if (hot.ix) return hot.ix.includes(index);
    if (hot.v) {
      if (!VOWELS.includes(character) || index < (hot.m || 0)) return false;
      return !(index === typed.length - 1 && character === "e");
    }
    if (index < (hot.m || 0)) return false;
    return Boolean(hot.c && hot.c.includes(character));
  }

  function theta(state, code) {
    const profile = state.codes[code];
    return profile ? profile.a / (profile.a + profile.b) : 0;
  }

  function codeBroken(state, code) {
    const profile = state.codes[code];
    return Boolean(profile && profile.seen >= 3 && theta(state, code) < 0.40);
  }

  function unitLocked(state, unit) {
    const codePrerequisites = { E8: ["E7"], E5: ["E8"], E1: ["E8"], E2: ["E8"], E9: ["E7"] };
    const unitPrerequisites = { "8.1": ["E8", "E5", "E1", "E2"] };
    return (unitPrerequisites[unit.id] || codePrerequisites[unit.err] || []).some((code) => codeBroken(state, code));
  }

  function fastPass(state, unit) {
    const profile = state.codes[unit.err];
    return !state.cleared[unit.id] && !unitLocked(state, unit) && unit.err !== "E0"
      && Boolean(profile && profile.seen >= 4 && theta(state, unit.err) >= 0.75);
  }

  function fnv1a32(input) {
    let hash = 0x811c9dc5;
    for (const character of input) {
      const codePoint = character.codePointAt(0);
      const bytes = codePoint <= 0x7f ? [codePoint]
        : codePoint <= 0x7ff ? [0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f)]
          : codePoint <= 0xffff
            ? [0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f)]
            : [0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f)];
      for (const byte of bytes) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
    }
    return hash.toString(16).padStart(8, "0");
  }

  function assessmentShuffle(ids, seed) {
    let value = parseInt(fnv1a32(seed), 16) >>> 0;
    const output = ids.slice();
    for (let index = output.length - 1; index > 0; index--) {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      const swap = value % (index + 1);
      [output[index], output[swap]] = [output[swap], output[index]];
    }
    return output;
  }

  function validFieldPackDescriptor(value) {
    if (!value || !Number.isInteger(value.version) || !Array.isArray(value.unitIds)
      || value.unitIds.length < 1 || value.unitIds.length > 32) return false;
    const ids = value.unitIds.map(String);
    return new Set(ids).size === ids.length && ids.every((id) => /^\d+\.\d+$/.test(id));
  }

  function knownFieldPackDescriptor(value) {
    return validFieldPackDescriptor(value)
      && value.version === FIELD_PACK_VERSION
      && value.unitIds.length === FIELD_PACK_IDS.length
      && value.unitIds.every((id, index) => id === FIELD_PACK_IDS[index]);
  }

  function normalizeImportedProgress(value, nowMs) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "invalid_progress" };
    const next = clone(value);
    const descriptor = next.fieldPack;
    if (!descriptor) return { ok: true, state: next };
    if (!validFieldPackDescriptor(descriptor)) return { ok: false, error: "invalid_field_pack_descriptor" };
    if (knownFieldPackDescriptor(descriptor)) return { ok: true, state: next };
    const quarantine = next.quarantine && typeof next.quarantine === "object" ? next.quarantine : {};
    const entries = Array.isArray(quarantine.fieldPacks) ? quarantine.fieldPacks : [];
    if (entries.length >= 4) return { ok: false, error: "field_pack_quarantine_full" };
    const ids = new Set(descriptor.unitIds);
    const docs = {};
    const cleared = {};
    const sched = {};
    const reportingModules = {};
    next.docs = next.docs && typeof next.docs === "object" ? next.docs : {};
    next.cleared = next.cleared && typeof next.cleared === "object" ? next.cleared : {};
    next.sched = next.sched && typeof next.sched === "object" ? next.sched : {};
    for (const id of ids) {
      if (Object.hasOwn(next.docs, id)) { docs[id] = next.docs[id]; delete next.docs[id]; }
      if (Object.hasOwn(next.cleared, id)) { cleared[id] = next.cleared[id]; delete next.cleared[id]; }
    }
    for (const [key, event] of Object.entries(next.sched)) {
      if (ids.has(event?.unit)) { sched[key] = event; delete next.sched[key]; }
    }
    let session = null;
    const blocks = next.session && Array.isArray(next.session.blocks) ? next.session.blocks : [];
    const touchesPack = blocks.some((block) => ids.has(block.id) || ids.has(sched[block.key]?.unit));
    if (touchesPack) {
      session = clone(next.session);
      const sessionId = next.session.id;
      next.session.status = "abandoned";
      next.session.endedAt = nowMs;
      next.session.reason = "unknown_pack_version";
      const row = Array.isArray(next.sessions) ? next.sessions.find((entry) => entry.id === sessionId) : null;
      if (row) {
        row.status = "abandoned";
        row.endedAt = nowMs;
        row.reason = "unknown_pack_version";
        row.revision = (row.revision || 1) + 1;
      }
      next.session = null;
    }
    if (next.reporting?.days && typeof next.reporting.days === "object") {
      for (const [day, bucket] of Object.entries(next.reporting.days)) {
        if (!Array.isArray(bucket.modulesCleared)) continue;
        const removed = bucket.modulesCleared.filter((id) => ids.has(id));
        if (removed.length) {
          reportingModules[day] = removed;
          bucket.modulesCleared = bucket.modulesCleared.filter((id) => !ids.has(id));
        }
      }
    }
    entries.push({
      version: descriptor.version, unitIds: descriptor.unitIds.slice(), quarantinedAt: nowMs,
      docs, cleared, sched, session, reportingModules,
    });
    next.quarantine = { ...quarantine, fieldPacks: entries };
    delete next.fieldPack;
    return { ok: true, state: next, quarantined: true };
  }

  function create(options) {
    if (!options || typeof options !== "object") throw new TypeError("WordbreakCore.create requires options");
    const nowMs = Number(options.nowMs);
    const timezoneOffsetMinutes = Number(options.timezoneOffsetMinutes);
    if (!Number.isFinite(nowMs)) throw new TypeError("nowMs must be finite");
    if (!Number.isFinite(timezoneOffsetMinutes)) throw new TypeError("timezoneOffsetMinutes must be finite");
    if (typeof options.random !== "function") throw new TypeError("random must be a function");
    if (typeof options.uuid !== "function") throw new TypeError("uuid must be a function");

    const content = clone(options.content || {});
    const units = content.UNITS || content.units || [];
    const assessmentForms = content.ASSESSMENT_FORMS || content.assessment || { A: [], B: [] };
    for (const unit of units) for (const word of unit.words || []) word.err ||= unit.err || "E0";
    let committedState = normalizeState(parseState(options.stateJson), nowMs, timezoneOffsetMinutes);
    let committedScreen = options.viewModel && typeof options.viewModel === "object" && !Array.isArray(options.viewModel)
      ? clone(options.viewModel)
      : initialScreen();
    let pending = null;

    function currentWord(screen) {
      return screen.mode === "review" ? screen.queue[screen.qIdx].w : screen.unit.words[screen.wordIdx];
    }

    function scheduleKey(unit, word) {
      return `${unit.id}|${word.a.toLowerCase()}`;
    }

    function scheduledList(state, { dueOnly = false } = {}) {
      const today = Math.floor(nowMs / DAY_MS);
      const output = [];
      for (const entry of Object.values(state.sched)) {
        if (dueOnly && entry.due > today) continue;
        const unit = units.find((candidate) => candidate.id === entry.unit);
        if (!unit) continue;
        const word = unit.words.find((candidate) => candidate.a.toLowerCase() === entry.word);
        if (word) output.push({ u: unit, w: word, e: entry });
      }
      output.sort((left, right) => (left.e.due - right.e.due)
        || ((ERR_WEIGHT[right.w.err] || 0) - (ERR_WEIGHT[left.w.err] || 0))
        || (right.e.lapses - left.e.lapses));
      return output;
    }

    function dueList(state) {
      return scheduledList(state, { dueOnly: true });
    }

    function unitOrder(left, right) {
      const parts = (unit) => {
        const minor = unit.id.split(".")[1] || "";
        return [unit.st, parseInt(minor, 10) || 0, minor.replace(/^\d+/, "")];
      };
      const a = parts(left);
      const b = parts(right);
      return (a[0] - b[0]) || (a[1] - b[1]) || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0);
    }

    function frontierUnits(state, session) {
      const queued = new Set((session?.blocks || []).filter((block) => block.k === "mod").map((block) => block.id));
      return units.filter((unit) => !state.cleared[unit.id] && !unitLocked(state, unit) && !queued.has(unit.id))
        .sort(unitOrder);
    }

    function modulePanelCells(state, unit) {
      return state.docs[unit.id] ? 0 : unit.docs.length;
    }

    function moduleCells(state, unit) {
      return modulePanelCells(state, unit) + (fastPass(state, unit) ? 1 : unit.words.length);
    }

    function estimatedModuleSeconds(state, unit) {
      return (state.docs[unit.id] ? 0 : unit.docs.length * SEC_PANEL)
        + (fastPass(state, unit) ? 1 : unit.words.length) * SEC_WORD;
    }

    function moduleProductionOpportunities(state, unit) {
      return fastPass(state, unit) ? 1 : unit.words.length;
    }

    function compileSession(state, budgetMin, bonus) {
      const blocks = [];
      let estimated = 0;
      let plannedOpportunities = 0;
      const frontier = frontierUnits(state, { blocks });
      if (bonus) {
        if (frontier.length) {
          const unit = frontier[0];
          blocks.push({ k: "mod", id: unit.id, cells: moduleCells(state, unit), pc: modulePanelCells(state, unit) });
          plannedOpportunities += moduleProductionOpportunities(state, unit);
        }
      } else {
        if (frontier.length) {
          const unit = frontier.shift();
          blocks.push({ k: "mod", id: unit.id, cells: moduleCells(state, unit), pc: modulePanelCells(state, unit) });
          estimated += estimatedModuleSeconds(state, unit);
          plannedOpportunities += moduleProductionOpportunities(state, unit);
        }
        let reviews = 0;
        const queuedReviewKeys = new Set();
        for (const due of dueList(state)) {
          if (estimated >= budgetMin * 60 || reviews >= REVIEW_BLOCKS_PER_SESSION) break;
          const key = scheduleKey(due.u, due.w);
          blocks.push({ k: "rev", key, cells: 1 });
          queuedReviewKeys.add(key);
          estimated += SEC_REV;
          reviews++;
          plannedOpportunities++;
        }
        for (const review of scheduledList(state)) {
          if (plannedOpportunities >= MIN_PRODUCTION_OPPORTUNITIES || reviews >= REVIEW_BLOCKS_PER_SESSION) break;
          const key = scheduleKey(review.u, review.w);
          if (queuedReviewKeys.has(key)) continue;
          blocks.push({ k: "rev", key, cells: 1, early: true });
          queuedReviewKeys.add(key);
          estimated += SEC_REV;
          reviews++;
          plannedOpportunities++;
        }
        for (const unit of frontier) {
          if (estimated + estimatedModuleSeconds(state, unit) > budgetMin * 60) break;
          blocks.push({ k: "mod", id: unit.id, cells: moduleCells(state, unit), pc: modulePanelCells(state, unit) });
          estimated += estimatedModuleSeconds(state, unit);
          plannedOpportunities += moduleProductionOpportunities(state, unit);
        }
      }
      return {
        v: SESSION_QUEUE_VERSION, id: options.uuid(), day: dayNumber(nowMs, timezoneOffsetMinutes),
        startReportDay: reportDay(nowMs, timezoneOffsetMinutes), startedAt: nowMs,
        status: "in_progress", revision: 1, activeMs: 0, budgetMin, blocks, idx: 0,
        done: false, bonus: Boolean(bonus), baseDone: Boolean(bonus), stats: { words: 0, clean: 0 },
      };
    }

    function openSessionBlock(state, screen) {
      const block = state.session.blocks[state.session.idx];
      if (!block) {
        screen.screen = "sessionDone";
        return;
      }
      if (block.k === "rev") {
        const entry = state.sched[block.key];
        const unit = units.find((candidate) => candidate.id === entry.unit);
        const word = unit.words.find((candidate) => candidate.a.toLowerCase() === entry.word);
        Object.assign(screen, {
          session: true, docsReadOnly: false, mode: "review", queue: [{ u: unit, w: word, e: entry }],
          qIdx: 0, unit: clone(unit), screen: "run", log: [],
        });
        startWord(screen);
      } else {
        const unit = units.find((candidate) => candidate.id === block.id);
        Object.assign(screen, {
          session: true, docsReadOnly: false, mode: "module", unit: clone(unit), log: [],
          wordIdx: 0, fastPass: fastPass(state, unit), fastCleared: false,
        });
        if (state.docs[unit.id]) {
          screen.screen = "run";
          startWord(screen);
        } else {
          screen.screen = "docs";
          screen.docsIdx = 0;
          screen.ketsuPick = null;
          screen.ketsuTyped = false;
          screen.ketsuMiss = 0;
        }
      }
    }

    function result(state, screen, { effects = [], semanticEvents = [] } = {}) {
      const output = {
        stateJson: serialize(state), viewModel: clone(screen),
        effects: clone(effects), semanticEvents: clone(semanticEvents),
      };
      pending = { ...output, state: clone(state), screen: clone(screen) };
      return output;
    }

    function startWord(screen) {
      if (screen.mode === "review" && screen.queue[screen.qIdx]) screen.unit = screen.queue[screen.qIdx].u;
      screen.runGen++;
      Object.assign(screen, {
        phase: "type", typed: "", flagIdx: null, aimGood: false, firstClean: false,
        walkAnyway: false, condQ: 0, condPicks: {}, lineupSpent: {}, witnessFound: false,
        memPhase: "study", patchTries: 0, reveal: false, tShown: nowMs, latency: null,
      });
    }

    function scheduleWord(state, screen, word, firstClean) {
      const key = `${screen.unit.id}|${word.a.toLowerCase()}`;
      const today = Math.floor(nowMs / DAY_MS);
      const entry = state.sched[key] || { box: 0, lapses: 0, seen: 0, unit: screen.unit.id, word: word.a.toLowerCase() };
      const sameDayReplay = entry.last === today;
      entry.seen++;
      if (firstClean) {
        if (!sameDayReplay) entry.box = Math.min(entry.box + 1, BOX_DAYS.length - 1);
      } else {
        entry.lapses++;
        entry.box = 0;
      }
      entry.last = today;
      entry.due = today + BOX_DAYS[entry.box];
      state.sched[key] = entry;
    }

    function logWord(state, screen) {
      const word = currentWord(screen);
      const solve = word.fork.k === "mem" ? (screen.firstClean ? "—" : "booked")
        : screen.firstClean && !screen.aimGood ? "—" : (screen.aimGood ? "earned" : "handed");
      screen.log.push({ module: screen.unit.nm, word: word.a, clean: screen.firstClean, aim: screen.aimGood, solve, err: word.err });
      const event = {
        t: nowMs, unit: screen.unit.id, word: word.a, clean: screen.firstClean,
        aim: screen.aimGood, solve, err: word.err, latency: screen.latency,
        tries: screen.patchTries, revealed: screen.reveal,
      };
      state.log.push(event);
      const report = reportTouch(state, reportDay(nowMs, timezoneOffsetMinutes));
      report.practiceEvents++;
      if (screen.firstClean) report.clean++;
      if (screen.aimGood) report.liveAim++;
      if (screen.mode === "review") {
        report.reviewEvents++;
        if (screen.firstClean) report.reviewClean++;
        if (screen.aimGood) report.reviewLiveAim++;
      }
      if (word.err && word.err !== "E0") {
        const code = report.codes[word.err] || (report.codes[word.err] = { seen: 0, clean: 0, aim: 0 });
        code.seen++;
        if (screen.firstClean) code.clean++;
        if (screen.aimGood) code.aim++;
      }
      if (state.log.length > LOG_CAP) state.log = state.log.slice(-LOG_CAP);
      scheduleWord(state, screen, word, screen.firstClean);
      updateCode(state, word.err, gradeEncounter(event));
      if (screen.mode !== "review") {
        const lastWord = screen.wordIdx === screen.unit.words.length - 1;
        const fastClear = screen.fastPass && screen.firstClean && screen.wordIdx === 0;
        if (lastWord || fastClear) {
          const newlyCleared = !state.cleared[screen.unit.id];
          state.cleared[screen.unit.id] = true;
          if (newlyCleared && !report.modulesCleared.includes(screen.unit.id)) report.modulesCleared.push(screen.unit.id);
          if (fastClear && !lastWord) screen.fastCleared = true;
        }
      }
      return event;
    }

    function dispatch(action) {
      if (!action || typeof action !== "object" || typeof action.type !== "string") {
        throw new TypeError("dispatch requires an action with a type");
      }
      const state = clone(committedState);
      const screen = clone(committedScreen);
      const semanticEvents = [];

      if (action.type === "state.read") return result(state, screen);

      if (action.type === "progress.import") {
        const imported = normalizeImportedProgress(action.state, nowMs);
        if (!imported.ok) throw new RangeError(imported.error);
        return result(normalizeState(imported.state, nowMs, timezoneOffsetMinutes), screen, {
          semanticEvents: [{ type: "progress.imported", quarantined: Boolean(imported.quarantined), atMs: nowMs }],
        });
      }

      if (action.type === "unit.openRun") {
        const unit = units.find((candidate) => candidate.id === action.unitId);
        if (!unit || !state.docs[action.unitId]) throw new RangeError("Unit is unavailable or unread");
        Object.assign(screen, {
          session: Boolean(action.session), docsReadOnly: false, mode: "module",
          unit: clone(unit), screen: "run", wordIdx: 0, log: [], fastPass: fastPass(state, unit),
          fastCleared: false,
        });
        startWord(screen);
        return result(state, screen);
      }

      if (action.type === "docs.complete") {
        if (screen.screen !== "docs" || !screen.unit) throw new RangeError("No lesson is open");
        state.docs[screen.unit.id] = true;
        screen.screen = "run";
        screen.wordIdx = 0;
        startWord(screen);
        semanticEvents.push({ type: "unit.docs.completed", unitId: screen.unit.id, atMs: nowMs });
        return result(state, screen, { semanticEvents });
      }

      if (action.type === "word.commitTyped") {
        const value = String(action.value || "").trim();
        if (!value || screen.screen !== "run" || screen.phase !== "type") return result(state, screen);
        screen.latency = screen.latency === null ? Math.max(0, nowMs - screen.tShown) : screen.latency;
        screen.typed = value;
        screen.phase = "flag";
        screen.flagIdx = null;
        return result(state, screen);
      }

      if (action.type === "word.start") {
        if (screen.screen !== "run") throw new RangeError("A word can only start inside a run");
        if (Number.isInteger(action.wordIndex)) screen.wordIdx = action.wordIndex;
        startWord(screen);
        return result(state, screen);
      }

      if (action.type === "word.setFlag") {
        if (screen.phase !== "flag") throw new RangeError("A letter can only be flagged after typing");
        screen.flagIdx = Number(action.index);
        return result(state, screen);
      }

      if (action.type === "word.execute") {
        const word = currentWord(screen);
        const clean = screen.typed.toLowerCase() === word.a.toLowerCase();
        screen.aimGood = isHot(word, screen.typed, screen.flagIdx);
        screen.firstClean = clean;
        if (clean && word.fork.k !== "mem" && !screen.aimGood) {
          screen.phase = "done";
          semanticEvents.push({ type: "word.completed", ...logWord(state, screen) });
        } else {
          screen.phase = "fork";
        }
        return result(state, screen, { semanticEvents });
      }

      if (action.type === "word.toPatch") {
        screen.phase = "patch";
        screen.patchTries = 0;
        return result(state, screen);
      }

      if (action.type === "word.confirmDone") {
        screen.phase = "done";
        semanticEvents.push({ type: "word.completed", ...logWord(state, screen) });
        return result(state, screen, { semanticEvents });
      }

      if (action.type === "word.commitPatch") {
        const word = currentWord(screen);
        const value = String(action.value || "").trim().toLowerCase();
        if (value === word.a.toLowerCase()) {
          screen.phase = "done";
          semanticEvents.push({ type: "word.completed", ...logWord(state, screen) });
        } else {
          screen.patchTries++;
          if (screen.patchTries >= 3 && !screen.reveal) screen.reveal = true;
        }
        return result(state, screen, { semanticEvents });
      }

      if (action.type === "word.advance") {
        if (screen.screen !== "run" || screen.phase !== "done") {
          throw new RangeError("A completed word is required before advancing");
        }
        const lastWord = screen.wordIdx >= screen.unit.words.length - 1 || screen.fastCleared;
        if (!lastWord) {
          screen.wordIdx++;
          startWord(screen);
          return result(state, screen);
        }
        if (!screen.session || !state.session) {
          screen.screen = "map";
          return result(state, screen);
        }

        state.session.idx++;
        state.session.revision = (state.session.revision || 1) + 1;
        const row = state.sessions.find((entry) => entry.id === state.session.id);
        if (row) {
          row.doneBlocks = Math.min(row.blocksTotal, state.session.idx);
          row.revision = (row.revision || 1) + 1;
        }
        if (state.session.idx < state.session.blocks.length) {
          openSessionBlock(state, screen);
          semanticEvents.push({
            type: "session.block.completed",
            sessionId: state.session.id,
            blockIndex: state.session.idx - 1,
            atMs: nowMs,
          });
          return result(state, screen, { semanticEvents });
        }

        state.session = {
          ...state.session, done: true, status: "completed", endedAt: nowMs,
          revision: (state.session.revision || 1) + 1,
        };
        if (row && row.status === "in_progress") {
          row.status = "completed";
          row.endedAt = nowMs;
          row.revision = (row.revision || 1) + 1;
          const report = reportTouch(state, state.session.startReportDay || reportDay(state.session.startedAt, timezoneOffsetMinutes));
          report[state.session.bonus ? "bonusCompleted" : "sessionsCompleted"]++;
          if (!state.session.bonus) state.assessment.nonbonusCompletedTotal++;
        }
        screen.screen = "sessionDone";
        semanticEvents.push({ type: "session.completed", sessionId: state.session.id, atMs: nowMs });
        return result(state, screen, { semanticEvents });
      }

      if (action.type === "assessment.start") {
        if (state.assessment.runs.some((run) => run.status === "in_progress")) return result(state, screen);
        const id = options.uuid();
        if (!state.assessment.assignment) state.assessment.assignment = Math.floor(options.random() * 256) % 2 ? "A" : "B";
        const role = action.role || "baseline";
        const form = role === "baseline" ? state.assessment.assignment : (state.assessment.assignment === "A" ? "B" : "A");
        state.assessment.runs.push({
          id, role, form, status: "in_progress",
          order: assessmentShuffle(assessmentForms[form].map((item) => item.id), id),
          cursor: 0, responses: [], replays: {}, startedAt: nowMs, completedAt: null,
          completedNonbonusTotal: null, interruptions: 0, comparable: true, reasons: [],
          device: clone(action.device || { userAgent: "unknown", platform: "unknown" }),
          staticAudioFailed: false,
        });
        screen.screen = "assessment";
        screen.assessmentPagehideRecorded = false;
        semanticEvents.push({ type: "assessment.started", assessmentId: id, role, atMs: nowMs });
        return result(state, screen, { semanticEvents });
      }

      if (action.type === "session.begin") {
        const today = dayNumber(nowMs, timezoneOffsetMinutes);
        if (state.session && !state.session.done) {
          if (state.session.day === today) {
            // Resume exactly when the committed screen is inside this session (reload, relaunch);
            // otherwise (e.g. imported progress with a neutral screen) reopen its current block.
            if (!(screen.session && (screen.screen === "docs" || screen.screen === "run"))) openSessionBlock(state, screen);
            return result(state, screen);
          }
          // Like the legacy runner (sessionValid), an unfinished session from an earlier local day
          // is abandoned rather than replayed, and today's work is compiled fresh.
          state.session.status = "abandoned";
          state.session.endedAt = nowMs;
          state.session.reason = "stale_day";
          const row = state.sessions.find((entry) => entry.id === state.session.id);
          if (row && row.status === "in_progress") {
            row.status = "abandoned";
            row.endedAt = nowMs;
            row.reason = "stale_day";
            row.revision = (row.revision || 1) + 1;
          }
          semanticEvents.push({ type: "session.abandoned", sessionId: state.session.id, reason: "stale_day", atMs: nowMs });
          state.session = null;
        }
        if (!action.bonus && state.sessions.some((entry) => entry.day === today && entry.status === "completed" && !entry.bonus)) {
          screen.screen = "sessionDone";
          return result(state, screen, { semanticEvents });
        }
        const budgetMin = Number.isFinite(action.budgetMin) ? action.budgetMin : DEFAULT_SESSION_MIN;
        state.session = compileSession(state, budgetMin, Boolean(action.bonus));
        if (!state.session.blocks.length) {
          state.session = null;
          return result(state, screen, { semanticEvents });
        }
        state.sessions.push({
          id: state.session.id, day: state.session.day, startReportDay: state.session.startReportDay,
          status: "in_progress", revision: 1, bonus: state.session.bonus, budgetMin,
          blocksTotal: state.session.blocks.length, doneBlocks: 0, activeMs: 0,
          startedAt: nowMs, endedAt: null,
        });
        const report = reportTouch(state, state.session.startReportDay);
        report[state.session.bonus ? "bonusStarted" : "sessionsStarted"]++;
        openSessionBlock(state, screen);
        semanticEvents.push({ type: "session.started", sessionId: state.session.id, atMs: nowMs, budgetMin });
        return result(state, screen, { semanticEvents });
      }

      if (action.type === "session.complete") {
        if (!state.session || state.session.done) return result(state, screen);
        state.session = {
          ...state.session, done: true, status: "completed", endedAt: nowMs,
          revision: (state.session.revision || 1) + 1,
        };
        const row = state.sessions.find((entry) => entry.id === state.session.id);
        if (row && row.status === "in_progress") {
          row.status = "completed";
          row.endedAt = nowMs;
          row.revision = (row.revision || 1) + 1;
          const report = reportTouch(state, state.session.startReportDay || reportDay(state.session.startedAt, timezoneOffsetMinutes));
          report[state.session.bonus ? "bonusCompleted" : "sessionsCompleted"]++;
          if (!state.session.bonus) state.assessment.nonbonusCompletedTotal++;
        }
        screen.screen = "sessionDone";
        semanticEvents.push({ type: "session.completed", sessionId: state.session.id, atMs: nowMs });
        return result(state, screen, { semanticEvents });
      }

      throw new RangeError(`Unknown Wordbreak action: ${action.type}`);
    }

    function accept(stateJson) {
      if (!pending || stateJson !== pending.stateJson) throw new Error("Only the exact pending state may be accepted");
      committedState = pending.state;
      committedScreen = pending.screen;
      pending = null;
    }

    function discard() {
      pending = null;
    }

    return Object.freeze({
      dispatch, accept, discard,
      stateJson: () => serialize(committedState),
      content: () => clone(content),
    });
  }

  root.WordbreakCore = Object.freeze({ create, stateVersion: STATE_VERSION });
})(typeof globalThis === "object" ? globalThis : this);
