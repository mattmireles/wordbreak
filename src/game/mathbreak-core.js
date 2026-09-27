/* Deterministic Mathbreak learning engine. Host owns persistence and effects. */
(function installMathbreakCore(root) {
  "use strict";

  const STATE_VERSION = 1;
  const LANES = ["addition", "subtraction", "multiplication", "division"];
  const DAY_MS = 86_400_000;

  function dayNumber(nowMs, timezoneOffsetMinutes) {
    return Math.floor((nowMs - timezoneOffsetMinutes * 60_000) / DAY_MS);
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function parseState(stateJson) {
    const parsed = JSON.parse(stateJson || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("Mathbreak state must be a JSON object");
    }
    return parsed;
  }

  function normalizeState(raw) {
    return {
      ...raw,
      version: STATE_VERSION,
      placement: raw.placement && typeof raw.placement === "object" ? raw.placement : null,
      practice: raw.practice && typeof raw.practice === "object" ? raw.practice : null,
      history: Array.isArray(raw.history) ? raw.history : [],
      revision: Number.isInteger(raw.revision) ? raw.revision : 0,
    };
  }

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    }
    return value;
  }

  function serialize(value) {
    return JSON.stringify(stable(value));
  }

  function itemText(item) {
    return `${item.left} ${item.operator} ${item.right}`;
  }

  function strategyChoices(item) {
    const a = item.left;
    const b = item.right;
    const answer = item.answer;
    let correct;
    switch (item.strategyId) {
      case "make-ten":
        correct = item.operator === "+"
          ? `10 + ${answer - 10}`
          : `10 - ${10 - answer}`;
        break;
      case "doubles": {
        const base = Math.min(a, b);
        correct = `${base} + ${base} + ${answer - (2 * base)}`;
        break;
      }
      case "inverse-family":
        correct = item.operator === "÷"
          ? `${b} × ${answer} = ${a}`
          : `${b} + ${answer} = ${a}`;
        break;
      case "anchors-2-5-10":
        correct = `${a + 1} × ${b} − ${b}`;
        break;
      case "double-halve":
        correct = item.operator === "÷"
          ? `${a * 2} ÷ ${b * 2}`
          : (b % 2 === 0 ? `${a * 2} × ${b / 2}` : `${a / 2} × ${b * 2}`);
        break;
      case "commute":
        correct = `${b} × ${a}`;
        break;
      case "distribute":
      default:
        correct = `${a - 1} × ${b} + 1 × ${b}`;
        break;
    }
    return [
      { id: "equivalent", text: correct, equivalent: true },
      { id: "off-by-one", text: `${answer - 1}`, equivalent: false },
      { id: "changed-number", text: `${a} ${item.operator} ${b + 1}`, equivalent: false },
    ];
  }

  function weakestLane(responses) {
    const counts = Object.fromEntries(LANES.map((lane) => [lane, { right: 0, total: 0 }]));
    for (const response of responses) {
      counts[response.lane].total++;
      if (response.correct) counts[response.lane].right++;
    }
    return LANES.reduce((weakest, lane) => {
      const score = counts[lane].total ? counts[lane].right / counts[lane].total : 1;
      const weakestScore = counts[weakest].total ? counts[weakest].right / counts[weakest].total : 1;
      return score < weakestScore ? lane : weakest;
    }, LANES[0]);
  }

  function weakestFamily(items, responses) {
    const order = [];
    const misses = {};
    for (const item of items) {
      if (!order.includes(item.factFamily)) order.push(item.factFamily);
      misses[item.factFamily] = 0;
    }
    for (const response of responses) if (!response.correct) misses[response.factFamily]++;
    return order.reduce((weakest, family) => misses[family] > misses[weakest] ? family : weakest, order[0]);
  }

  function practiceQueue(items, family, random, gap) {
    const target = items.find((item) => item.factFamily === family) || items[0];
    const related = items.filter((item) => item.factFamily === family && item.id !== target.id);
    const fillers = items.filter((item) => item.factFamily !== family);
    const offset = fillers.length ? Math.floor(random() * fillers.length) % fillers.length : 0;
    const rotated = fillers.slice(offset).concat(fillers.slice(0, offset));
    const between = rotated.slice(0, Math.max(gap, 3));
    return [target, ...(related.length ? [related[0]] : []), ...between, { ...target, retrieval: true }];
  }

  function create(options) {
    if (!options || !options.content || !Array.isArray(options.content.broadScreener)) {
      throw new TypeError("Mathbreak content is required");
    }
    if (!Number.isFinite(options.nowMs) || typeof options.random !== "function") {
      throw new TypeError("Injected clock and random source are required");
    }
    const timezoneOffsetMinutes = Number(options.timezoneOffsetMinutes);
    if (!Number.isFinite(timezoneOffsetMinutes)) throw new TypeError("timezoneOffsetMinutes must be finite");
    // Injected clock; a long-lived host advances it with `nowMs` on each action. The practice
    // day stays fixed to the engine's creation so a queue never flips days mid-run.
    let nowMs = options.nowMs;
    const today = dayNumber(nowMs, timezoneOffsetMinutes);
    const content = clone(options.content);
    let committedState = normalizeState(parseState(options.stateJson));
    let pending = null;

    function currentItem(state) {
      if (state.placement?.phase === "screener") {
        return content.broadScreener[state.placement.cursor] || null;
      }
      if (state.placement?.phase === "probe") {
        return content.laneProbes[state.placement.lane][state.placement.cursor] || null;
      }
      if (state.practice) return state.practice.queue[state.practice.cursor] || null;
      return null;
    }

    function viewModel(state) {
      const item = currentItem(state);
      if (!state.placement) return { screen: "ready", subject: "math" };
      if (state.placement.phase === "complete" && !state.practice) {
        return { screen: "ready", subject: "math", lane: state.placement.lane };
      }
      if (state.practice?.done) {
        return { screen: "mathDone", subject: "math", lane: state.placement.lane };
      }
      const phase = state.practice?.phase || "attempt";
      const strategy = item?.strategyId
        ? content.strategies.find((candidate) => candidate.id === item.strategyId)
        : null;
      return {
        screen: state.placement.phase === "screener" || state.placement.phase === "probe" ? "mathPlacement" : "mathPractice",
        subject: "math",
        stage: state.placement.phase,
        phase,
        item: item ? clone(item) : null,
        prompt: item ? itemText(item) : null,
        position: state.practice ? state.practice.cursor + 1 : state.placement.cursor + 1,
        total: state.practice ? state.practice.queue.length : (
          state.placement.phase === "screener"
            ? content.broadScreener.length
            : content.laneProbes[state.placement.lane].length
        ),
        strategy: strategy ? clone(strategy) : null,
        strategyChoices: phase === "bridge" && item ? strategyChoices(item).map(({ equivalent, ...choice }) => choice) : [],
        lane: state.placement.lane || null,
      };
    }

    function result(state, semanticEvents = []) {
      const output = {
        stateJson: serialize(state),
        viewModel: viewModel(state),
        effects: [],
        semanticEvents: clone(semanticEvents),
      };
      pending = { ...output, state: clone(state) };
      return output;
    }

    function recordAnswer(state, item, answer, latencyMs, stage) {
      const correct = Number(answer) === item.answer;
      const response = {
        itemId: item.id,
        lane: item.lane || state.placement.lane,
        factFamily: item.factFamily || null,
        answer: Number(answer),
        correct,
        latencyMs: Number.isFinite(latencyMs) ? Math.max(0, latencyMs) : null,
        atMs: nowMs,
      };
      if (stage === "practice") state.history.push({ ...response, stage, retrieval: Boolean(item.retrieval) });
      else state.placement.responses.push({ ...response, stage });
      return response;
    }

    function beginPractice(state) {
      const probes = content.laneProbes[state.placement.lane];
      const probeResponses = state.placement.responses.filter((response) => response.stage === "probe");
      const family = weakestFamily(probes, probeResponses);
      const strategyId = probes.find((item) => item.factFamily === family).strategyId;
      state.placement = { ...state.placement, phase: "complete", family, strategyId };
      state.practice = {
        day: today,
        phase: "attempt",
        cursor: 0,
        queue: practiceQueue(
          probes,
          family,
          options.random,
          content.delayedRetrieval?.minimumInterveningItems || 3,
        ),
        done: false,
        firstAnswerCorrect: null,
        strategyConstructed: false,
      };
    }

    function dispatch(action) {
      if (!action || typeof action.type !== "string") throw new TypeError("dispatch requires an action with a type");
      if (action.nowMs !== undefined) {
        if (!Number.isFinite(action.nowMs)) throw new TypeError("action.nowMs must be finite");
        nowMs = action.nowMs;
      }
      const state = clone(committedState);
      const events = [];

      if (action.type === "state.read") return result(state);
      if (action.type === "session.begin") {
        if (!state.placement) {
          state.placement = { phase: "screener", cursor: 0, responses: [], lane: null };
          state.revision++;
          events.push({ type: "math.placement.started", atMs: nowMs });
        } else if (state.placement.phase === "complete" && (!state.practice || (state.practice.done && state.practice.day !== today))) {
          beginPractice(state);
          state.revision++;
          events.push({ type: "math.practice.started", lane: state.placement.lane, atMs: nowMs });
        }
        return result(state, events);
      }
      if (action.type === "answer.submit") {
        const item = currentItem(state);
        if (!item) throw new RangeError("No active math item");
        if (state.practice) {
          if (state.practice.phase !== "attempt") throw new RangeError("Answer is not expected now");
          const response = recordAnswer(state, item, action.answer, action.latencyMs, "practice");
          state.practice.firstAnswerCorrect = response.correct;
          state.practice.phase = "bridge";
          events.push({ type: "math.answer", ...response, stage: "practice" });
        } else {
          const stage = state.placement.phase;
          const response = recordAnswer(state, item, action.answer, action.latencyMs, stage);
          state.placement.cursor++;
          events.push({ type: "math.answer", ...response, stage });
          if (stage === "screener" && state.placement.cursor >= content.broadScreener.length) {
            state.placement.lane = weakestLane(state.placement.responses);
            state.placement.phase = "probe";
            state.placement.cursor = 0;
            events.push({ type: "math.lane.selected", lane: state.placement.lane, atMs: nowMs });
          } else if (stage === "probe" && state.placement.cursor >= content.laneProbes[state.placement.lane].length) {
            beginPractice(state);
            events.push({
              type: "math.path.selected",
              lane: state.placement.lane,
              factFamily: state.placement.family,
              strategyId: state.placement.strategyId,
              atMs: nowMs,
            });
          }
        }
        state.revision++;
        return result(state, events);
      }
      if (action.type === "strategy.select") {
        if (!state.practice || state.practice.phase !== "bridge") throw new RangeError("Strategy is not expected now");
        const item = currentItem(state);
        const choice = strategyChoices(item).find((candidate) => candidate.id === action.choiceId);
        if (!choice) throw new RangeError("Unknown strategy construction");
        if (choice.equivalent) {
          state.practice.strategyConstructed = true;
          state.practice.phase = "retype";
        }
        state.revision++;
        events.push({
          type: "math.strategy.selected",
          itemId: item.id,
          strategyId: item.strategyId,
          choiceId: choice.id,
          equivalent: choice.equivalent,
          atMs: nowMs,
        });
        return result(state, events);
      }
      if (action.type === "answer.retype") {
        if (!state.practice || state.practice.phase !== "retype") throw new RangeError("Retype is not expected now");
        const item = currentItem(state);
        const correct = Number(action.answer) === item.answer;
        events.push({ type: "math.retyped", itemId: item.id, correct, atMs: nowMs });
        if (correct) {
          state.practice.cursor++;
          state.practice.phase = "attempt";
          state.practice.firstAnswerCorrect = null;
          state.practice.strategyConstructed = false;
          if (state.practice.cursor >= state.practice.queue.length) {
            state.practice.done = true;
            events.push({ type: "math.session.completed", lane: state.placement.lane, atMs: nowMs });
          }
        }
        state.revision++;
        return result(state, events);
      }
      throw new RangeError(`Unknown Mathbreak action: ${action.type}`);
    }

    function accept(stateJson) {
      if (!pending || stateJson !== pending.stateJson) throw new Error("Only the exact pending state may be accepted");
      committedState = pending.state;
      pending = null;
    }

    function discard() {
      pending = null;
    }

    return Object.freeze({ dispatch, accept, discard, stateJson: () => serialize(committedState) });
  }

  root.MathbreakCore = Object.freeze({ create, stateVersion: STATE_VERSION });
})(typeof globalThis === "object" ? globalThis : this);
