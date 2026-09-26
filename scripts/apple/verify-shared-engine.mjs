#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { extractRuntime } from "../runtime-data.mjs";

const root = resolve(new URL("../..", import.meta.url).pathname);
const appArgument = process.argv.find((argument) => argument.startsWith("--app="));
if (!appArgument) throw new Error("Usage: npm run verify:ios:engine -- --app=/path/to/Wordbreak.app");
const appPath = resolve(appArgument.slice("--app=".length));

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

const sources = [
  "wordbreak-core.js",
  "wordbreak-content.js",
  "mathbreak-core.js",
  "mathbreak-content.json",
];
const hashes = {};
for (const name of sources) {
  const source = readFileSync(resolve(root, "src/game", name));
  const bundled = readFileSync(resolve(appPath, name));
  const sourceHash = sha256(source);
  const bundledHash = sha256(bundled);
  if (sourceHash !== bundledHash) throw new Error(`${name} differs between authored source and ${basename(appPath)}`);
  hashes[name] = sourceHash;
}

const runtime = extractRuntime(root).runtimeHashes;
if (runtime.engineHash !== hashes["wordbreak-core.js"]) throw new Error("Browser engine hash differs from iOS engine bytes");
if (runtime.contentSourceHash !== hashes["wordbreak-content.js"]) throw new Error("Browser content-source hash differs from iOS content bytes");

console.log(`Verified exact shared engine bytes in ${appPath}:`);
console.log(`  engine  ${runtime.engineHash}`);
console.log(`  content ${runtime.contentSourceHash}`);
console.log(`  normalized curriculum ${runtime.contentHash}`);
console.log(`  math engine ${hashes["mathbreak-core.js"]}`);
console.log(`  math content ${hashes["mathbreak-content.json"]}`);
