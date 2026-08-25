#!/usr/bin/env node
/**
 * Deploy Wordbreak Worker using Cloudflare creds from the gist repo .env
 * (or WORDBREAK_ENV_FILE / CLOUDFLARE_* already in the environment).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const KEYS = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"];

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (KEYS.includes(k) && v) out[k] = v;
  }
  return out;
}

const candidates = [
  process.env.WORDBREAK_ENV_FILE,
  resolve(root, ".env"),
  resolve(root, "../gist/.env"),
].filter(Boolean);

let loaded = {};
let from = null;
for (const p of candidates) {
  const got = loadEnvFile(p);
  if (got.CLOUDFLARE_ACCOUNT_ID && got.CLOUDFLARE_API_TOKEN) {
    loaded = got;
    from = p;
    break;
  }
}

// Explicit CI/operator environment always wins over a convenience env file.
const env = { ...loaded, ...process.env };
for (const k of KEYS) {
  if (!env[k]) {
    console.error(
      `Missing ${k}. Set it, or provide a .env with gist Cloudflare credentials.`
    );
    process.exit(1);
  }
}

if (from) console.log(`==> Cloudflare credentials from ${from}`);

const expectedAccount = "dc678e9a2bc3233faab6a99bbb4c4292";
if (env.CLOUDFLARE_ACCOUNT_ID !== expectedAccount) {
  console.error("Refusing deploy: unexpected Cloudflare account.");
  process.exit(1);
}
const config = readFileSync(resolve(root, "wrangler.jsonc"), "utf8");
for (const required of [
  '"name": "wordbreak"',
  '"database_id": "9af59c56-e70e-4adc-a701-33350d37f69f"',
  '"pattern": "wordbreak.fun"',
  '"pattern": "www.wordbreak.fun"',
]) {
  if (!config.includes(required)) {
    console.error("Refusing deploy: Wrangler identity assertion failed.");
    process.exit(1);
  }
}

const r = spawnSync("npx", ["wrangler", "deploy"], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
