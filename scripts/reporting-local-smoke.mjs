#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 8791;
const base = `http://127.0.0.1:${port}`;
const learner = randomUUID();
const epoch = randomUUID();
const code = `local-smoke-${randomUUID()}-${randomUUID()}`;
const codeHash = createHash("sha256").update(code).digest("hex");
const now = Date.now();
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
}).format(now);

function wrangler(args) {
  const result = spawnSync("npx", ["wrangler", ...args], { cwd: root, encoding: "utf8" });
  if (result.status) throw new Error(result.stderr || result.stdout || `wrangler failed: ${args.join(" ")}`);
  return result.stdout;
}

function sql(statement) {
  return wrangler(["d1", "execute", "wordbreak-reporting", "--local", "--command", statement]);
}

async function waitForReady(child) {
  await new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error("wrangler dev readiness timeout")), 20_000);
    const inspect = (chunk) => {
      if (!String(chunk).includes(`localhost:${port}`) && !String(chunk).includes(`127.0.0.1:${port}`)) return;
      clearTimeout(timer); resolveReady();
    };
    child.stdout.on("data", inspect);
    child.stderr.on("data", inspect);
    child.once("exit", (status) => { clearTimeout(timer); reject(new Error(`wrangler dev exited before readiness (${status})`)); });
  });
}

async function main() {
  let child;
  try {
    wrangler(["d1", "migrations", "apply", "wordbreak-reporting", "--local"]);
    sql(`UPDATE service_config SET value=1 WHERE key='ingest_enabled';
      INSERT INTO learners(id,active_epoch,created_at) VALUES('${learner}','${epoch}',${now});
      INSERT INTO reporting_epochs(id,learner_id,started_at,start_day) VALUES('${epoch}','${learner}',${now},'${day}');
      INSERT INTO enrollment_codes(code_hash,learner_id,requested_epoch,same_stream,created_at,expires_at)
        VALUES('${codeHash}','${learner}','${epoch}',1,${now},${now + 600000});`);

    child = spawn("npx", ["wrangler", "dev", "--test-scheduled", "--port", String(port)], {
      cwd: root, stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForReady(child);
    const canonical = { origin: "https://wordbreak.fun", "content-type": "application/json" };
    let response = await fetch(`${base}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /text\/html/);

    response = await fetch(`${base}/api/reporting/enroll`, {
      method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}",
    });
    assert.equal(response.status, 403);

    response = await fetch(`${base}/api/reporting/enroll`, {
      method: "POST", headers: canonical, body: JSON.stringify({ code }),
    });
    assert.equal(response.status, 200);
    const credential = await response.json();
    assert.equal(credential.learnerId, learner);
    assert.ok(credential.token);

    response = await fetch(`${base}/api/reporting/enroll`, {
      method: "POST", headers: canonical, body: JSON.stringify({ code }),
    });
    assert.equal(response.status, 400);

    const headers = { ...canonical, authorization: `Bearer ${credential.token}` };
    const aggregate = {
      day, revision: 1, activeMs: 90000, practiceEvents: 4, clean: 3, liveAim: 2,
      reviewEvents: 1, reviewClean: 1, reviewLiveAim: 1, sessionsStarted: 1,
      sessionsCompleted: 1, sessionsAbandoned: 0, bonusStarted: 0, bonusCompleted: 0,
      modulesCleared: ["9.1"], codes: { E1: { seen: 4, clean: 3, aim: 2 } },
    };
    const payload = {
      schemaVersion: 1, sourceRevision: 2, days: [aggregate], outboxDepth: 0,
      checkpoint: { earliestCompleteDay: day, completeThroughDay: day, gaps: [] },
    };
    response = await fetch(`${base}/api/reporting/sync`, { method: "POST", headers, body: JSON.stringify(payload) });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).accepted, [{ day, revision: 1 }]);

    response = await fetch(`${base}/api/reporting/sync`, { method: "POST", headers, body: JSON.stringify(payload) });
    assert.equal(response.status, 429);
    await new Promise((resolveWait) => setTimeout(resolveWait, 1100));
    response = await fetch(`${base}/api/reporting/sync`, { method: "POST", headers, body: JSON.stringify(payload) });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).accepted, [{ day, revision: 1 }]);

    response = await fetch(`${base}/api/reporting/disconnect`, { method: "POST", headers, body: "{}" });
    assert.equal(response.status, 200);
    response = await fetch(`${base}/api/reporting/sync`, { method: "POST", headers, body: JSON.stringify(payload) });
    assert.equal(response.status, 401);
    console.log("Real local-D1 Worker smoke passed: origin, enrollment, replay denial, 9.1 sync, rate limit, idempotence, disconnect.");
  } finally {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolveExit) => { child.once("exit", resolveExit); setTimeout(resolveExit, 3000); });
    }
    sql(`DELETE FROM learners WHERE id='${learner}'; UPDATE service_config SET value=0 WHERE key='ingest_enabled';`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
