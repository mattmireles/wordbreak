#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const manifest = JSON.parse(readFileSync(resolve(root, "docs/audio/audio-manifest.json"), "utf8"));
const runtimeFiles = JSON.parse(readFileSync(resolve(root, "public/audio/manifest.json"), "utf8"));
const audioDir = resolve(root, "public/audio");

function isMp3(bytes) {
  const hasId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const hasFrameSync = bytes.some((byte, index) => index + 1 < bytes.length && byte === 0xff && (bytes[index + 1] & 0xe0) === 0xe0);
  return hasId3 || hasFrameSync;
}

const expected = new Set();
for (const clip of manifest.clips) {
  if (expected.has(clip.file)) throw new Error(`Duplicate manifest file: ${clip.file}`);
  expected.add(clip.file);
  const path = resolve(audioDir, clip.file);
  if (!existsSync(path)) throw new Error(`Missing audio asset: ${clip.file}`);
  const bytes = new Uint8Array(readFileSync(path));
  if (!bytes.length || !isMp3(bytes)) throw new Error(`Invalid MP3 asset: ${clip.file}`);
}

const actual = new Set(readdirSync(audioDir).filter((file) => file.endsWith(".mp3")));
for (const file of actual) if (!expected.has(file)) throw new Error(`Orphan audio asset: ${file}`);
if (actual.size !== expected.size) throw new Error(`MP3 count mismatch: ${actual.size} actual, ${expected.size} expected`);
const runtime = new Set(runtimeFiles);
if (runtime.size !== runtimeFiles.length || runtime.size !== expected.size) throw new Error("Runtime manifest contains duplicates or wrong count");
for (const file of expected) if (!runtime.has(file)) throw new Error(`Runtime manifest missing: ${file}`);
for (const file of runtime) if (!actual.has(file)) throw new Error(`Runtime manifest points at missing asset: ${file}`);

console.log(`Verified ${actual.size} valid MP3 assets; runtime manifest matches exactly.`);
