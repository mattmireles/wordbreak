#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractRuntime } from "../runtime-data.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export function validateAssessmentBank({ units, assessment }, methodology = "") {
  const errors = [], seenIds = new Set(), seenTargets = new Set();
  const taught = new Set();
  for (const unit of units) {
    for (const word of unit.words) taught.add(word.a.toLowerCase());
    for (const doc of unit.docs) if (doc.ty) taught.add(doc.ty.toLowerCase());
  }
  for (const match of methodology.matchAll(/\*([^*\n]+)\*/g)) {
    const text = match[1].trim().toLowerCase();
    if (/^[a-z]+$/.test(text)) taught.add(text);
    for (const token of text.split(/[,/→ ]+/)) if (/^[a-z]+$/.test(token)) taught.add(token);
  }
  if (assessment.version !== 2) errors.push("BANK:version");
  for (const form of ["A", "B"]) {
    const items = assessment[form];
    if (!Array.isArray(items) || items.length !== 24) { errors.push(`${form}:count`); continue; }
    for (const item of items) {
      const fail = reason => errors.push(`${item.id || form}:${reason}`);
      if (!item.id?.startsWith(`${form}-`) || seenIds.has(item.id)) fail("id");
      seenIds.add(item.id);
      if (!/^[a-z]+$/.test(item.target || "")) fail("target_shape");
      if (seenTargets.has(item.target)) fail("duplicate_target");
      seenTargets.add(item.target);
      if (taught.has(item.target)) fail("taught_overlap");
      if (!/^E(?:[1-9]|10|11)$/.test(item.primaryCode || "")) fail("primary_code");
      if (!Number.isInteger(item.syllables) || item.syllables < 1 || item.syllables > 7) fail("syllables");
      if (!['common', 'school', 'advanced'].includes(item.frequencyBand)) fail("frequency");
      if (!Array.isArray(item.ambiguity) || !item.ambiguity.length || item.ambiguity.some(i => !Number.isInteger(i) || i < 0 || i >= item.target.length)) fail("ambiguity");
      if (!item.sourceNote?.includes("checked")) fail("source_note");
      const visible = `${item.sentenceBefore}${item.sentenceAfter}`.toLowerCase();
      if (new RegExp(`(^|[^a-z])${item.target}([^a-z]|$)`).test(visible)) fail("answer_leak");
      if (!item.audioText.startsWith(`${item.target}. `) || !item.audioText.includes(`${item.sentenceBefore}${item.target}${item.sentenceAfter}`)) fail("audio_text");
    }
  }
  for (let i = 0; i < 24; i++) {
    const a = assessment.A[i], b = assessment.B[i];
    if (a.primaryCode !== b.primaryCode) errors.push(`${a.id}/${b.id}:pair_code`);
    if (Math.abs(a.syllables - b.syllables) > 1) errors.push(`${a.id}/${b.id}:pair_syllables`);
    if (Math.abs(a.ambiguity.length - b.ambiguity.length) > 2) errors.push(`${a.id}/${b.id}:pair_ambiguity`);
  }
  return errors.sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const runtime = extractRuntime(root);
  const methodology = readFileSync(resolve(root, "methodology.md"), "utf8");
  const errors = validateAssessmentBank(runtime, methodology);
  if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
  console.log("Verified 2 matched assessment forms, 24 items each, with no taught-target overlap.");
}
