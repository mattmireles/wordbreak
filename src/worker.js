import { boundedJson, canonical, HttpError, isMonotonic, json, normalizeDay, sha256, validOrigin } from "./reporting.js";
import { cleanup, generateCanaries, generateMissingReports, sweepReports } from "./report.js";

async function enabled(env, key) {
  return Number(await env.REPORTING_DB.prepare("SELECT value FROM service_config WHERE key=?").bind(key).first("value")) === 1;
}

async function auth(request, env) {
  const raw = request.headers.get("authorization") || "";
  if (!raw.startsWith("Bearer ")) throw new HttpError(401, "unauthorized");
  const tokenHash = await sha256(raw.slice(7));
  const row = await env.REPORTING_DB.prepare("SELECT d.*,l.active_epoch,l.disabled_at FROM device_credentials d JOIN learners l ON l.id=d.learner_id WHERE d.token_hash=?").bind(tokenHash).first();
  if (!row || row.revoked_at || row.expires_at <= Date.now() || row.disabled_at || row.stream_epoch !== row.active_epoch) throw new HttpError(401, "unauthorized");
  return row;
}

async function enroll(request, env) {
  if (!await enabled(env, "ingest_enabled")) throw new HttpError(404, "not_found");
  const body = await boundedJson(request, 2048);
  if (typeof body.code !== "string" || body.code.length < 32 || body.code.length > 512) throw new HttpError(400, "invalid_enrollment");
  const now = Date.now(), codeHash = await sha256(body.code), token = crypto.randomUUID() + crypto.randomUUID(), tokenHash = await sha256(token), deviceId = crypto.randomUUID();
  let result;
  try {
    result = await env.REPORTING_DB.prepare(`INSERT INTO device_credentials (id,learner_id,stream_epoch,enrollment_code_hash,token_hash,created_at,expires_at)
      SELECT ?,ec.learner_id,ec.requested_epoch,ec.code_hash,?,?,? FROM enrollment_codes ec
      JOIN learners l ON l.id=ec.learner_id JOIN reporting_epochs re ON re.id=ec.requested_epoch
      WHERE ec.code_hash=? AND ec.used_at IS NULL AND ec.expires_at>? AND l.disabled_at IS NULL
      RETURNING learner_id,stream_epoch`).bind(deviceId, tokenHash, now, now + 365 * 86400000, codeHash, now).first();
  } catch { throw new HttpError(400, "invalid_enrollment"); }
  if (!result) throw new HttpError(400, "invalid_enrollment");
  const revision = await env.REPORTING_DB.prepare("SELECT max_accepted_revision FROM reporting_epochs WHERE id=?").bind(result.stream_epoch).first("max_accepted_revision");
  return json({ learnerId: result.learner_id, deviceId, streamEpoch: result.stream_epoch, token, serverRevision: Number(revision || 0) });
}

async function sync(request, env) {
  if (!await enabled(env, "ingest_enabled")) throw new HttpError(404, "not_found");
  const device = await auth(request, env), now = Date.now();
  const rateClaim = await env.REPORTING_DB.prepare("UPDATE device_credentials SET last_used_at=? WHERE id=? AND revoked_at IS NULL AND (last_used_at IS NULL OR last_used_at<=?)").bind(now, device.id, now - 1000).run();
  if (rateClaim.meta.changes !== 1) throw new HttpError(429, "rate_limited");
  const body = await boundedJson(request);
  if (body.schemaVersion !== 1 || !Number.isInteger(body.sourceRevision) || body.sourceRevision < 1 || !Array.isArray(body.days) || body.days.length > 14) throw new HttpError(422, "invalid_sync");
  const accepted = [], rejected = [];
  for (const raw of body.days) {
    let day;
    try { day = normalizeDay(raw); } catch (error) { rejected.push({ day: raw?.day || null, revision: raw?.revision || null, error: error.code || "invalid_day" }); continue; }
    const dayMs = Date.parse(`${day.day}T12:00:00Z`);
    if (!Number.isFinite(dayMs) || dayMs < now - 65 * 86400000 || day.day > new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now + 300000)) {
      rejected.push({ day: day.day, revision: day.revision, error: "day_out_of_range" }); continue;
    }
    const prior = await env.REPORTING_DB.prepare("SELECT * FROM daily_summaries WHERE learner_id=? AND stream_epoch=? AND report_day=?").bind(device.learner_id, device.stream_epoch, day.day).first();
    const payloadHash = await sha256(canonical(day));
    if (prior && day.revision < prior.revision) { accepted.push({ day: day.day, revision: prior.revision }); continue; }
    if (prior && day.revision === prior.revision) {
      if (payloadHash === prior.payload_hash) accepted.push({ day: day.day, revision: prior.revision });
      else rejected.push({ day: day.day, revision: day.revision, error: "revision_conflict" });
      continue;
    }
    if (!isMonotonic(day, prior)) { rejected.push({ day: day.day, revision: day.revision, error: "non_monotonic" }); continue; }
    await env.REPORTING_DB.prepare(`INSERT INTO daily_summaries VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(learner_id,stream_epoch,report_day) DO UPDATE SET revision=excluded.revision,active_ms=excluded.active_ms,practice_events=excluded.practice_events,clean=excluded.clean,live_aim=excluded.live_aim,review_events=excluded.review_events,review_clean=excluded.review_clean,review_live_aim=excluded.review_live_aim,sessions_started=excluded.sessions_started,sessions_completed=excluded.sessions_completed,sessions_abandoned=excluded.sessions_abandoned,bonus_started=excluded.bonus_started,bonus_completed=excluded.bonus_completed,modules_json=excluded.modules_json,codes_json=excluded.codes_json,payload_hash=excluded.payload_hash,received_at=excluded.received_at WHERE excluded.revision>daily_summaries.revision`)
      .bind(device.learner_id, device.stream_epoch, day.day, day.revision, day.activeMs, day.practiceEvents, day.clean, day.liveAim, day.reviewEvents, day.reviewClean, day.reviewLiveAim, day.sessionsStarted, day.sessionsCompleted, day.sessionsAbandoned, day.bonusStarted, day.bonusCompleted, JSON.stringify(day.modulesCleared), JSON.stringify(day.codes), payloadHash, now).run();
    accepted.push({ day: day.day, revision: day.revision });
  }
  const statements = [
    env.REPORTING_DB.prepare("UPDATE learners SET last_sync_at=? WHERE id=?").bind(now, device.learner_id),
    env.REPORTING_DB.prepare("UPDATE reporting_epochs SET max_accepted_revision=MAX(max_accepted_revision,?) WHERE id=?").bind(body.sourceRevision, device.stream_epoch),
  ];
  if (body.state) {
    const state = normalizeState(body.state), hash = await sha256(canonical(state));
    statements.push(env.REPORTING_DB.prepare(`INSERT INTO learner_state VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(learner_id) DO UPDATE SET stream_epoch=excluded.stream_epoch,revision=excluded.revision,synced_at=excluded.synced_at,cleared_json=excluded.cleared_json,docs_count=excluded.docs_count,due_count=excluded.due_count,profile_json=excluded.profile_json,legacy_json=excluded.legacy_json,incomplete_since=excluded.incomplete_since,payload_hash=excluded.payload_hash WHERE excluded.revision>learner_state.revision`).bind(device.learner_id, device.stream_epoch, state.revision, now, JSON.stringify(state.cleared), state.docsCount, state.dueCount, JSON.stringify(state.profile), JSON.stringify(state.legacy), state.incompleteSince, hash));
  }
  if (body.outboxDepth === 0 && body.checkpoint) {
    const cp = normalizeCheckpoint(body.checkpoint);
    statements.push(env.REPORTING_DB.prepare("UPDATE reporting_epochs SET max_drained_revision=MAX(max_drained_revision,?),earliest_complete_day=?,complete_through_day=?,gaps_json=? WHERE id=?").bind(body.sourceRevision, cp.earliestCompleteDay, cp.completeThroughDay, JSON.stringify(cp.gaps), device.stream_epoch));
    statements.push(env.REPORTING_DB.prepare("UPDATE learners SET last_complete_sync_at=?,earliest_complete_day=?,complete_through_day=?,gaps_json=? WHERE id=?").bind(now, cp.earliestCompleteDay, cp.completeThroughDay, JSON.stringify(cp.gaps), device.learner_id));
  }
  await env.REPORTING_DB.batch(statements);
  return json({ accepted, rejected, serverRevision: body.sourceRevision });
}

function normalizeState(state) {
  if (!state || !Number.isInteger(state.revision) || state.revision < 1 || !Array.isArray(state.cleared) || !Number.isInteger(state.docsCount) || !Number.isInteger(state.dueCount)) throw new HttpError(422, "invalid_state");
  return { revision: state.revision, cleared: [...new Set(state.cleared)].sort(), docsCount: state.docsCount, dueCount: state.dueCount, profile: state.profile || {}, legacy: state.legacy || {}, incompleteSince: state.incompleteSince || null };
}

function normalizeCheckpoint(cp) {
  if (!cp || typeof cp.earliestCompleteDay !== "string" || typeof cp.completeThroughDay !== "string" || !Array.isArray(cp.gaps) || JSON.stringify(cp.gaps).length > 8192) throw new HttpError(422, "invalid_checkpoint");
  return cp;
}

async function disconnect(request, env) {
  const device = await auth(request, env);
  await env.REPORTING_DB.prepare("UPDATE device_credentials SET revoked_at=? WHERE id=? AND revoked_at IS NULL").bind(Date.now(), device.id).run();
  return json({ disconnected: true });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith("/api/reporting/")) {
        if (url.hostname === "www.wordbreak.fun") return Response.redirect(`https://wordbreak.fun${url.pathname}${url.search}`, 308);
        return env.ASSETS.fetch(request);
      }
      if (!validOrigin(request, env)) throw new HttpError(403, "forbidden_origin");
      if (request.method !== "POST") throw new HttpError(405, "method_not_allowed");
      if (url.pathname === "/api/reporting/enroll") return await enroll(request, env);
      if (url.pathname === "/api/reporting/sync") return await sync(request, env);
      if (url.pathname === "/api/reporting/disconnect") return await disconnect(request, env);
      throw new HttpError(404, "not_found");
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.code }, error.status);
      console.error("reporting_internal", error?.name || "Error", error?.message || "unknown");
      return json({ error: "internal_error" }, 500);
    }
  },
  async scheduled(controller, env, ctx) {
    const now = controller.scheduledTime || Date.now();
    ctx.waitUntil((async () => {
      await env.REPORTING_DB.prepare("UPDATE reports SET status='unknown',lease_until=NULL,last_error_kind='expired_lease' WHERE status='sending' AND lease_until<?").bind(now).run();
      await generateCanaries(env, now);
      await generateMissingReports(env, now);
      await sweepReports(env, now);
      await env.REPORTING_DB.prepare("UPDATE learners SET canary_accepted_at=? WHERE canary_accepted_at IS NULL AND EXISTS (SELECT 1 FROM canary_requests c JOIN reports r ON r.learner_id=c.learner_id AND r.period_start_day=c.report_period WHERE c.learner_id=learners.id AND r.status='accepted')").bind(now).run();
      await cleanup(env, now);
    })());
  },
};
