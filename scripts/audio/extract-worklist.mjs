#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildAudioWorklist } from "./worklist.mjs";

const root = resolve(import.meta.dirname, "../..");
const { manifest, runtimeFiles, stats } = buildAudioWorklist(root);

mkdirSync(resolve(root, "docs/audio"), { recursive: true });
mkdirSync(resolve(root, "public/audio"), { recursive: true });
writeFileSync(resolve(root, "docs/audio/audio-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(resolve(root, "public/audio/manifest.json"), `${JSON.stringify(runtimeFiles, null, 2)}\n`);
console.log(`Extracted ${stats.coreUnits} core units/${stats.coreWords} words and ${stats.packUnits} field-pack units/${stats.packWords} words; ${stats.coreWitnesses} core witnesses.`);
console.log(`Wrote ${stats.clips} clips for ${stats.uniqueTexts} unique spoken texts, including ${stats.assessmentItems} assessment items.`);
