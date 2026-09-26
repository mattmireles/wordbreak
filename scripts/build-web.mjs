#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const root = resolve(new URL("..", import.meta.url).pathname);
const checkOnly = process.argv.includes("--check");
const marker = "<!-- WORDBREAK_SCRIPTS -->";
const sourcePaths = [
  "src/game/wordbreak-content.js",
  "src/game/wordbreak-core.js",
  "src/game/wordbreak-browser.js",
];

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const template = read("src/web/wordbreak.template.html");
if (template.split(marker).length !== 2) {
  throw new Error(`Expected exactly one ${marker} marker in the web template`);
}

const sources = sourcePaths.map(read);
const contentContext = {};
contentContext.globalThis = contentContext;
runInNewContext(`${sources[0]}\n;globalThis.__content=createWordbreakContent(2);`, contentContext);
for (const unit of contentContext.__content.UNITS) {
  for (const word of unit.words) word.err ||= unit.err || "E0";
}
const runtime = {
  contentHash: sha256(JSON.stringify(canonicalize(contentContext.__content))),
  contentSourceHash: sha256(sources[0]),
  engineHash: sha256(sources[1]),
};
const metadata = `const WORDBREAK_RUNTIME=Object.freeze(${JSON.stringify(runtime)});`;
const generated = template.replace(marker, `<script>\n${metadata}\n${sources.filter((source) => source.length > 0).join("\n")}\x3c/script>`);
const outputs = ["wordbreak_v2.html", "public/index.html"];

if (checkOnly) {
  for (const output of outputs) {
    if (read(output) !== generated) {
      throw new Error(`${output} is stale; run npm run build:web`);
    }
  }
  console.log(`Verified ${outputs.length} generated web artifacts from ${sourcePaths.length} authored sources.`);
} else {
  mkdirSync(resolve(root, "public"), { recursive: true });
  for (const output of outputs) writeFileSync(resolve(root, output), generated);
  console.log(`Generated ${outputs.join(" and ")} from ${sourcePaths.join(", ")}.`);
}
