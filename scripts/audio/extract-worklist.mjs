#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";
import { AUDIO_GEN, AUDIO_SPEEDS, AUDIO_VOICE, clipKey, normalize } from "./key.mjs";

const root = resolve(import.meta.dirname, "../..");
const html = readFileSync(resolve(root, "wordbreak_v2.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
if (!script) throw new Error("Could not locate the inline application script");

const app = { innerHTML: "", addEventListener() {}, focus() {}, select() {} };
const context = {
  console,
  TextEncoder,
  setTimeout,
  clearTimeout,
  document: {
    getElementById: () => app,
    querySelectorAll: () => [],
    addEventListener() {},
  },
  window: {},
  localStorage: { getItem: () => null, setItem() {} },
  speechSynthesis: { cancel() {}, speak() {} },
  SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
};
context.globalThis = context;
runInNewContext(`${script}\n;globalThis.__UNITS = UNITS;`, context, { filename: "wordbreak_v2.html" });
const units = context.__UNITS;
if (!Array.isArray(units) || !units.length) throw new Error("UNITS extraction returned no units");

const expected = { units: 48, words: 192, witnesses: 4 };
const wordCount = units.reduce((sum, unit) => sum + unit.words.length, 0);
const witnessCount = units.reduce((sum, unit) => sum + unit.words.filter((word) =>
  word.fork?.items?.some((item) => item.role === "witness")).length, 0);
for (const [name, actual] of Object.entries({ units: units.length, words: wordCount, witnesses: witnessCount })) {
  if (actual !== expected[name]) throw new Error(`Unexpected ${name} count: got ${actual}, expected ${expected[name]}`);
}

const texts = new Map();
for (const unit of units) {
  for (const word of unit.words) {
    texts.set(normalize(word.a), { text: normalize(word.a) });
    for (const item of word.fork?.items || []) {
      if (item.role === "witness") texts.set(normalize(item.w), {
        text: normalize(item.w),
        fallbackText: item.sayAs || undefined,
      });
    }
  }
}

const clips = [];
const keys = new Map();
for (const entry of texts.values()) {
  for (const { speed, speedTag } of AUDIO_SPEEDS) {
    const key = clipKey(entry.text, speedTag === "s");
    const file = `${key}.mp3`;
    if (keys.has(key)) throw new Error(`Audio key collision: ${key} (${entry.text} / ${keys.get(key)})`);
    keys.set(key, entry.text);
    clips.push({ key, file, text: entry.text, ...(entry.fallbackText ? { fallbackText: entry.fallbackText } : {}), speed, speedTag });
  }
}

mkdirSync(resolve(root, "docs/audio"), { recursive: true });
mkdirSync(resolve(root, "public/audio"), { recursive: true });
const manifest = { gen: AUDIO_GEN, voice: AUDIO_VOICE, generatedFrom: "wordbreak_v2.html", clips };
writeFileSync(resolve(root, "docs/audio/audio-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(resolve(root, "public/audio/manifest.json"), `${JSON.stringify(clips.map((clip) => clip.file), null, 2)}\n`);
console.log(`Extracted ${units.length} units, ${wordCount} words, ${witnessCount} witnesses.`);
console.log(`Wrote ${clips.length} clips for ${texts.size} unique spoken texts.`);
