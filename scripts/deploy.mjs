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

const env = { ...process.env, ...loaded };
for (const k of KEYS) {
  if (!env[k]) {
    console.error(
      `Missing ${k}. Set it, or provide a .env with gist Cloudflare credentials.`
    );
    process.exit(1);
  }
}

if (from) console.log(`==> Cloudflare credentials from ${from}`);

const r = spawnSync("npx", ["wrangler", "deploy"], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
