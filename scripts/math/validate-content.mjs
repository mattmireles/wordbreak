#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(process.argv[2] || "src/game/mathbreak-content.json");
const content = JSON.parse(readFileSync(path, "utf8"));
const errors = [];
const ids = new Set();
const strategies = new Map(content.strategies.map((strategy) => [strategy.id, strategy]));
const evaluate = ({ left, operator, right }) => ({ "+": left + right, "-": left - right, "×": left * right, "÷": left / right })[operator];
const laneForOperator = { "+": "addition", "-": "subtraction", "×": "multiplication", "÷": "division" };

function checkItem(item, expectedLane, source) {
  if (!item.id || ids.has(item.id)) errors.push(`${source}:duplicate_or_missing_id:${item.id}`);
  ids.add(item.id);
  const lane = item.lane || expectedLane;
  if (lane !== expectedLane) errors.push(`${item.id}:lane:${lane}`);
  if (laneForOperator[item.operator] !== lane) errors.push(`${item.id}:operator_lane`);
  if (![item.left, item.right, item.answer].every(Number.isInteger)) errors.push(`${item.id}:integer`);
  if (evaluate(item) !== item.answer) errors.push(`${item.id}:answer`);
  if (item.operator === "÷" && (item.right === 0 || !Number.isInteger(item.left / item.right))) errors.push(`${item.id}:division`);
  if (lane === "addition" && (item.left < 0 || item.right < 0 || item.answer > 20)) errors.push(`${item.id}:addition_universe`);
  if (lane === "subtraction" && (item.left > 20 || item.right > 20 || item.answer < 0)) errors.push(`${item.id}:subtraction_universe`);
  if (lane === "multiplication" && (item.left < 0 || item.right < 0 || item.left > 12 || item.right > 12)) errors.push(`${item.id}:multiplication_universe`);
  if (lane === "division" && (item.right < 1 || item.right > 12 || item.answer < 0 || item.answer > 12)) errors.push(`${item.id}:division_universe`);
  if (item.strategyId) {
    const strategy = strategies.get(item.strategyId);
    if (!strategy || !strategy.lanes.includes(lane)) errors.push(`${item.id}:strategy`);
  }
}

if (content.version !== 1) errors.push("version");
if (content.timingPolicy !== "latency_is_private_observation_never_a_score") errors.push("timing_policy");
if (content.broadScreener.length !== 24) errors.push(`broad_screener_count:${content.broadScreener.length}`);
for (const lane of Object.keys(content.laneProbes)) {
  const broad = content.broadScreener.filter((item) => item.lane === lane);
  if (broad.length !== 6) errors.push(`${lane}:broad_count:${broad.length}`);
  for (const item of broad) checkItem(item, lane, "broad");
  const probes = content.laneProbes[lane];
  if (!Array.isArray(probes) || probes.length < 6) errors.push(`${lane}:probe_count`);
  for (const item of probes || []) checkItem(item, lane, "probe");
}
for (const item of content.heldOutProbes) checkItem(item, item.lane, "heldout");
for (const strategy of content.strategies) {
  if (!strategy.id || !strategy.title || !strategy.construction || !strategy.lanes?.length) errors.push(`strategy:${strategy.id || "missing"}`);
}
if (new Set(content.duplicateIdentities.map((identity) => `${identity.kind}:${identity.a}:${identity.b}`)).size !== content.duplicateIdentities.length) errors.push("duplicate_identity");
if (content.delayedRetrieval.minimumInterveningItems < 1 || content.delayedRetrieval.preferredInterveningItems < content.delayedRetrieval.minimumInterveningItems) errors.push("delayed_retrieval");
if (errors.length) {
  console.error(errors.sort().join("\n"));
  process.exit(1);
}
console.log(`Validated Mathbreak v${content.version}: ${content.broadScreener.length} broad items, ${Object.values(content.laneProbes).flat().length} lane probes, ${content.heldOutProbes.length} held-out probes, ${content.strategies.length} strategies.`);

