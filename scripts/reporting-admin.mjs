#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = process.env.WORDBREAK_ENV_FILE || resolve(root, "../gist/.env");
const allowed = new Set(["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "POSTMARK_SERVER_TOKEN", "POSTMARK_MESSAGE_STREAM", "PAPERS_ALERT_EMAIL_TO", "PAPERS_ALERT_EMAIL_FROM"]);
function readEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!raw || raw.trimStart().startsWith("#")) continue;
    const i = raw.indexOf("="); if (i < 1) continue;
    const key = raw.slice(0, i).trim(); if (!allowed.has(key)) continue;
    let value = raw.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}
const env = { ...readEnv(envFile), ...process.env };
if (env.CLOUDFLARE_ACCOUNT_ID !== "dc678e9a2bc3233faab6a99bbb4c4292" || !env.CLOUDFLARE_API_TOKEN) throw new Error("Unexpected or missing Cloudflare account credentials");
const cmd = process.argv[2], args = process.argv.slice(3);

function wrangler(parts, input) {
  const result = spawnSync("npx", ["wrangler", ...parts], { cwd: root, env, input, encoding: "utf8", stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"] });
  if (result.status) process.exit(result.status || 1);
}
function sql(statement) { wrangler(["d1", "execute", "wordbreak-reporting", "--remote", "--command", statement]); }
function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function q(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function day() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(); }

if (cmd === "migrate") {
  wrangler(["d1", "migrations", "apply", "wordbreak-reporting", "--remote"]);
} else if (cmd === "status") {
  sql("SELECT key,value,updated_at FROM service_config ORDER BY key; SELECT COUNT(*) AS learners FROM learners; SELECT COUNT(*) AS active_credentials FROM device_credentials WHERE revoked_at IS NULL;");
} else if (cmd === "create-learner") {
  const learner = randomUUID(), epoch = randomUUID(), now = Date.now();
  sql(`INSERT INTO learners(id,active_epoch,created_at) VALUES(${q(learner)},${q(epoch)},${now}); INSERT INTO reporting_epochs(id,learner_id,started_at,start_day) VALUES(${q(epoch)},${q(learner)},${now},${q(day())});`);
  console.log(`Learner created: ${learner}`);
} else if (cmd === "enroll") {
  const learner = args[0]; if (!/^[0-9a-f-]{36}$/i.test(learner || "")) throw new Error("Usage: reporting-admin enroll <learner-id> [replace]");
  const replace = args[1] === "replace", epoch = replace ? randomUUID() : args[1] || null, now = Date.now(), code = randomBytes(32).toString("base64url");
  let epochSql = "";
  if (replace) epochSql = `INSERT INTO reporting_epochs(id,learner_id,started_at,start_day) VALUES(${q(epoch)},${q(learner)},${now},${q(day())});`;
  const epochExpr = replace ? q(epoch) : `(SELECT active_epoch FROM learners WHERE id=${q(learner)})`;
  sql(`${epochSql} INSERT INTO enrollment_codes(code_hash,learner_id,requested_epoch,same_stream,created_at,expires_at) VALUES(${q(hash(code))},${q(learner)},${epochExpr},${replace ? 0 : 1},${now},${now + 1800000});`);
  const url = `https://wordbreak.fun/#report-enroll=${encodeURIComponent(code)}`;
  const copied = spawnSync("pbcopy", [], { input: url, encoding: "utf8" });
  if (copied.status) throw new Error("Could not copy enrollment URL");
  console.log("Single-use enrollment URL copied to clipboard; it expires in 30 minutes.");
} else if (cmd === "authorize") {
  const learner = args[0], column = cmd === "authorize" ? "guardian_authorized_at" : "mailbox_confirmed_at";
  if (!/^[0-9a-f-]{36}$/i.test(learner || "")) throw new Error(`Usage: reporting-admin ${cmd} <learner-id>`);
  sql(`UPDATE learners SET ${column}=${Date.now()} WHERE id=${q(learner)} AND disabled_at IS NULL;`);
} else if (cmd === "enqueue-canary") {
  const learner = args[0]; if (!/^[0-9a-f-]{36}$/i.test(learner || "")) throw new Error("Usage: reporting-admin enqueue-canary <learner-id>");
  sql(`INSERT INTO canary_requests(learner_id,requested_at) SELECT id,${Date.now()} FROM learners WHERE id=${q(learner)} AND guardian_authorized_at IS NOT NULL AND disabled_at IS NULL ON CONFLICT(learner_id) DO UPDATE SET requested_at=excluded.requested_at,generated_at=NULL,report_period=NULL;`);
  console.log("Canary queued for the real scheduled delivery path; no learner activity is included.");
} else if (cmd === "confirm-mailbox") {
  const learner = args[0]; if (!/^[0-9a-f-]{36}$/i.test(learner || "")) throw new Error("Usage: reporting-admin confirm-mailbox <learner-id>");
  sql(`UPDATE learners SET mailbox_confirmed_at=${Date.now()} WHERE id=${q(learner)} AND canary_accepted_at IS NOT NULL AND disabled_at IS NULL; SELECT canary_accepted_at,mailbox_confirmed_at FROM learners WHERE id=${q(learner)};`);
} else if (cmd === "config") {
  const key = args[0], value = Number(args[1]);
  if (!["ingest_enabled", "email_enabled"].includes(key) || ![0, 1].includes(value)) throw new Error("Usage: reporting-admin config <ingest_enabled|email_enabled> <0|1>");
  sql(`UPDATE service_config SET value=${value},updated_at=${Date.now()} WHERE key=${q(key)}; SELECT key,value,updated_at FROM service_config ORDER BY key;`);
} else if (cmd === "inspect") {
  const learner = args[0]; if (!/^[0-9a-f-]{36}$/i.test(learner || "")) throw new Error("Usage: reporting-admin inspect <learner-id>");
  sql(`SELECT id,active_epoch,guardian_authorized_at,reporting_started_at,canary_accepted_at,mailbox_confirmed_at,disabled_at,last_sync_at,last_complete_sync_at,earliest_complete_day,complete_through_day,gaps_json FROM learners WHERE id=${q(learner)}; SELECT report_day,revision,active_ms,practice_events,review_events,sessions_started,sessions_completed,sessions_abandoned FROM daily_summaries WHERE learner_id=${q(learner)} ORDER BY report_day DESC LIMIT 14;`);
} else if (cmd === "disable" || cmd === "delete") {
  const learner = args[0]; if (!/^[0-9a-f-]{36}$/i.test(learner || "")) throw new Error(`Usage: reporting-admin ${cmd} <learner-id>`);
  if (cmd === "disable") sql(`UPDATE learners SET disabled_at=${Date.now()} WHERE id=${q(learner)}; UPDATE device_credentials SET revoked_at=COALESCE(revoked_at,${Date.now()}) WHERE learner_id=${q(learner)};`);
  else { if (args[1] !== "--confirm") throw new Error("Deletion requires --confirm; D1 Time Travel may retain recoverable copies during its provider window."); sql(`DELETE FROM learners WHERE id=${q(learner)};`); }
} else if (cmd === "provision-secrets") {
  if (args[0] !== "--confirm-new-hmac") throw new Error("Provisioning creates a new address-HMAC key. Pass --confirm-new-hmac only for first setup or deliberate rotation; frozen reports must be reconciled after rotation.");
  const values = { POSTMARK_SERVER_TOKEN: env.POSTMARK_SERVER_TOKEN, POSTMARK_MESSAGE_STREAM: env.POSTMARK_MESSAGE_STREAM, REPORT_TO: env.PAPERS_ALERT_EMAIL_TO, REPORT_FROM: env.PAPERS_ALERT_EMAIL_FROM, REPORT_ADDRESS_HMAC_KEY: randomBytes(32).toString("base64url") };
  for (const [key, value] of Object.entries(values)) { if (!value) throw new Error(`Missing ${key} source value`); wrangler(["secret", "put", key, "--name", "wordbreak"], value); }
  console.log("Wordbreak reporting secrets provisioned; values were not printed.");
} else {
  console.log("Usage: reporting-admin <migrate|status|create-learner|enroll|authorize|enqueue-canary|confirm-mailbox|config|inspect|disable|delete|provision-secrets>");
  process.exitCode = 1;
}
