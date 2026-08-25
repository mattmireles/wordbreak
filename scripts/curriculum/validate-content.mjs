#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

import { extractRuntime } from "../runtime-data.mjs";

const ENTITY = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function visibleTokens(value) {
  const strings = [];
  function visit(node) {
    if (typeof node === "string") strings.push(node);
    else if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === "object") Object.values(node).forEach(visit);
  }
  visit(value);
  const text = strings.join(" ").replace(/<[^>]*>/g, " ").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
    }
    return ENTITY[entity.toLowerCase()] ?? " ";
  });
  return text.normalize("NFC").toLowerCase().match(/\p{L}+/gu) ?? [];
}

export function reservedAssessmentLeaks(pack, assessment) {
  const reserved = new Set([...assessment.A, ...assessment.B].map((item) => item.target.normalize("NFC").toLowerCase()));
  return [...new Set(visibleTokens(pack).filter((token) => reserved.has(token)))].sort();
}

export function validateRuntime(root) {
  const data = extractRuntime(root);
  const core = data.units.filter((unit) => !data.helpers.isPackUnit(unit));
  const pack = data.units.filter(data.helpers.isPackUnit);
  const errors = [];
  if (core.length !== 48) errors.push(`core_unit_count:${core.length}`);
  const coreWords = core.reduce((sum, unit) => sum + (unit.words?.length ?? 0), 0);
  if (coreWords !== 192) errors.push(`core_word_count:${coreWords}`);
  const ids = data.units.map((unit) => unit.id);
  if (new Set(ids).size !== ids.length) errors.push("duplicate_unit_id");
  for (const unit of core) {
    if (unit.docs?.length !== 4) errors.push(`${unit.id}:docs`);
    if (unit.words?.length !== 4) errors.push(`${unit.id}:words`);
  }
  if (![0, 4].includes(pack.length)) errors.push(`pack_unit_count:${pack.length}`);
  if (pack.length) {
    const expectedIds = Array.from(data.fieldPack.ids);
    if (JSON.stringify(pack.map((unit) => unit.id)) !== JSON.stringify(expectedIds)) errors.push("pack_order");
    if (pack.reduce((sum, unit) => sum + (unit.words?.length ?? 0), 0) !== 16) errors.push("pack_word_count");
    for (const unit of pack) {
      if (unit.docs?.length !== 4 || unit.words?.length !== 4) errors.push(`${unit.id}:shape`);
      if (unit.meta?.packVersion !== data.fieldPack.version) errors.push(`${unit.id}:version`);
      for (const field of ["morphemes", "rule", "etymologyHook", "tiers", "completionMeaning", "dictationFrames", "sourceNotes"]) {
        if (!unit.meta?.[field] || (Array.isArray(unit.meta[field]) && !unit.meta[field].length)) errors.push(`${unit.id}:meta_${field}`);
      }
    }
    for (const leak of reservedAssessmentLeaks(pack.map(({ docs, words }) => ({ docs, words })), data.assessment)) errors.push(`assessment_leak:${leak}`);
    const coreTargets = new Set(core.flatMap((unit) => [
      ...unit.words.map((word) => word.a.normalize("NFC").toLowerCase()),
      ...unit.docs.map((doc) => typeof doc.ty === "string" ? doc.ty.normalize("NFC").toLowerCase() : null).filter(Boolean),
    ]));
    const packTargets = pack.flatMap((unit) => unit.words.map((word) => word.a.normalize("NFC").toLowerCase()));
    if (new Set(packTargets).size !== packTargets.length) errors.push("duplicate_pack_target");
    for (const target of packTargets) if (coreTargets.has(target)) errors.push(`core_target_overlap:${target}`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return { coreUnits: core.length, coreWords, packUnits: pack.length, packWords: pack.reduce((sum, unit) => sum + (unit.words?.length ?? 0), 0) };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const result = validateRuntime(root);
  console.log(`Validated ${result.coreUnits} core units/${result.coreWords} words and ${result.packUnits} field-pack units/${result.packWords} words.`);
}
