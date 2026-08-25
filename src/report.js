import { canonical, reportDay, sha256 } from "./reporting.js";

const SUBJECT = "Your weekly Wordbreak report";

function mondayBefore(timestamp) {
  const parts = reportDay(timestamp).split("-").map(Number);
  const noon = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 20));
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" }).format(noon);
  const offset = { Sun: 6, Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5 }[weekday];
  noon.setUTCDate(noon.getUTCDate() - offset - 7);
  const start = reportDay(noon.getTime());
  noon.setUTCDate(noon.getUTCDate() + 7);
  return [start, reportDay(noon.getTime())];
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function buildReportModel(rows, learner, start, end) {
  const totals = rows.reduce((a, r) => {
    for (const key of ["active_ms", "practice_events", "clean", "live_aim", "review_events", "review_clean", "sessions_started", "sessions_completed", "sessions_abandoned", "bonus_started", "bonus_completed"]) a[key] += Number(r[key]);
    if (r.practice_events > 0) a.active_days++;
    return a;
  }, { active_ms: 0, practice_events: 0, clean: 0, live_aim: 0, review_events: 0, review_clean: 0, sessions_started: 0, sessions_completed: 0, sessions_abandoned: 0, bonus_started: 0, bonus_completed: 0, active_days: 0 });
  const endDate = new Date(`${end}T12:00:00Z`); endDate.setUTCDate(endDate.getUTCDate() - 1);
  const lastDay = reportDay(endDate.getTime());
  const gaps = JSON.parse(learner.gaps_json || "[]").filter(g => g.start < end && g.end >= start);
  const complete = rows.length === 7 && !rows.some(r => r.cutover_partial) && learner.complete_through_day && learner.complete_through_day >= lastDay && gaps.length === 0;
  return { version: 1, period: { start, end }, complete, totals, dataCutoff: learner.last_complete_sync_at || null };
}

export function renderReport(model) {
  const t = model.totals;
  const qualifier = model.complete ? "" : "At least ";
  const lines = [
    `Wordbreak · ${model.period.start} through ${model.period.end}`,
    "",
    `${qualifier}${t.active_days} active day${t.active_days === 1 ? "" : "s"}`,
    `${qualifier}${Math.round(t.active_ms / 60000)} estimated active minutes`,
    `${qualifier}${t.practice_events} spelling attempts`,
    `${qualifier}${t.sessions_completed} of ${t.sessions_started} habit sessions completed`,
  ];
  if (model.complete && t.practice_events >= 4) lines.push(`First-pass: ${Math.round(100 * (t.clean - t.review_clean) / Math.max(1, t.practice_events - t.review_events))}%`);
  else lines.push(model.complete ? "First-pass: measuring" : "Rates withheld because reporting coverage is incomplete.");
  if (!model.complete) lines.push("Some activity may be missing; counts are lower bounds.");
  lines.push("", `Data cutoff: ${model.dataCutoff ? new Date(model.dataCutoff).toISOString() : "not yet complete"}`);
  const text = lines.join("\n");
  const html = `<!doctype html><meta charset="utf-8"><title>${SUBJECT}</title><main style="font:16px/1.5 system-ui;max-width:620px;margin:auto;padding:24px"><h1>${SUBJECT}</h1>${lines.filter(Boolean).map(x => `<p>${esc(x)}</p>`).join("")}</main>`;
  return { subject: SUBJECT, text, html };
}

async function hmacHex(secret, domain, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${domain}\0${value}`));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
}

async function freezeReport(env, learnerId, start, end, model, rendered, now) {
  const recipientHmac = await hmacHex(env.REPORT_ADDRESS_HMAC_KEY, "recipient", env.REPORT_TO);
  const senderHmac = await hmacHex(env.REPORT_ADDRESS_HMAC_KEY, "sender", env.REPORT_FROM);
  const request = { From: env.REPORT_FROM, To: env.REPORT_TO, Subject: rendered.subject, TextBody: rendered.text, HtmlBody: rendered.html, MessageStream: env.POSTMARK_MESSAGE_STREAM, TrackOpens: false, TrackLinks: "None" };
  const requestHash = await sha256(canonical(request));
  await env.REPORTING_DB.prepare("INSERT OR IGNORE INTO reports (learner_id,period_start_day,period_end_day,status,generated_at,received_cutoff,data_cutoff,template_version,subject,model_json,text_body,html_body,message_stream,recipient_hmac,sender_hmac,request_hash) VALUES (?,?,?,'pending',?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(learnerId, start, end, now, now, model.dataCutoff, 1, rendered.subject, canonical(model), rendered.text, rendered.html, env.POSTMARK_MESSAGE_STREAM, recipientHmac, senderHmac, requestHash).run();
}

export async function generateCanaries(env, now) {
  const requests = await env.REPORTING_DB.prepare("SELECT c.*,l.guardian_authorized_at FROM canary_requests c JOIN learners l ON l.id=c.learner_id WHERE c.generated_at IS NULL AND l.disabled_at IS NULL").all();
  for (const row of requests.results) {
    if (!row.guardian_authorized_at) continue;
    const start = `canary-${reportDay(now)}`, end = `${start}z`;
    const model = { version: 1, canary: true, period: { start: reportDay(now), end: reportDay(now) }, complete: false, totals: { active_ms: 0, practice_events: 0, clean: 0, live_aim: 0, review_events: 0, review_clean: 0, sessions_started: 0, sessions_completed: 0, sessions_abandoned: 0, bonus_started: 0, bonus_completed: 0, active_days: 0 }, dataCutoff: null };
    const rendered = { subject: SUBJECT, text: "Wordbreak reporting setup test. No learner activity is included in this message.", html: "<!doctype html><meta charset=\"utf-8\"><p>Wordbreak reporting setup test. No learner activity is included in this message.</p>" };
    await freezeReport(env, row.learner_id, start, end, model, rendered, now);
    await env.REPORTING_DB.prepare("UPDATE canary_requests SET generated_at=?,report_period=? WHERE learner_id=? AND generated_at IS NULL").bind(now, start, row.learner_id).run();
  }
}

export async function generateMissingReports(env, now) {
  const [start, end] = mondayBefore(now);
  const learners = await env.REPORTING_DB.prepare("SELECT * FROM learners WHERE disabled_at IS NULL AND guardian_authorized_at IS NOT NULL AND mailbox_confirmed_at IS NOT NULL").all();
  for (const learner of learners.results) {
    const exists = await env.REPORTING_DB.prepare("SELECT 1 FROM reports WHERE learner_id=? AND period_start_day=?").bind(learner.id, start).first();
    if (exists) continue;
    const rows = await env.REPORTING_DB.prepare(`SELECT * FROM (
      SELECT ds.*,re.cutover_partial,ROW_NUMBER() OVER (PARTITION BY ds.report_day ORDER BY re.started_at DESC) AS owner_rank
      FROM daily_summaries ds JOIN reporting_epochs re ON re.id=ds.stream_epoch
      WHERE ds.learner_id=? AND ds.report_day>=? AND ds.report_day<?
        AND re.start_day<=ds.report_day AND (re.end_day IS NULL OR ds.report_day<=re.end_day)
    ) WHERE owner_rank=1 ORDER BY report_day`).bind(learner.id, start, end).all();
    const model = buildReportModel(rows.results, learner, start, end);
    const rendered = renderReport(model);
    await freezeReport(env, learner.id, start, end, model, rendered, now);
  }
}

export async function sweepReports(env, now, fetcher = fetch) {
  const enabled = await env.REPORTING_DB.prepare("SELECT value FROM service_config WHERE key='email_enabled'").first("value");
  if (!enabled) return;
  const candidates = await env.REPORTING_DB.prepare("SELECT * FROM reports WHERE status IN ('pending','definitive_failure') AND attempts<20 ORDER BY generated_at LIMIT 10").all();
  for (const row of candidates.results) {
    const lease = now + 120000;
    const claim = await env.REPORTING_DB.prepare("UPDATE reports SET status='sending',lease_until=?,attempts=attempts+1 WHERE learner_id=? AND period_start_day=? AND status IN ('pending','definitive_failure')").bind(lease, row.learner_id, row.period_start_day).run();
    if (claim.meta.changes !== 1) continue;
    const body = { From: env.REPORT_FROM, To: env.REPORT_TO, Subject: row.subject, TextBody: row.text_body, HtmlBody: row.html_body, MessageStream: row.message_stream, TrackOpens: false, TrackLinks: "None" };
    let response;
    try { response = await fetcher("https://api.postmarkapp.com/email", { method: "POST", headers: { "content-type": "application/json", "x-postmark-server-token": env.POSTMARK_SERVER_TOKEN }, body: JSON.stringify(body) }); }
    catch { await mark(env, row, "unknown", "transport_unknown"); continue; }
    if (response.status === 429) { await mark(env, row, "pending", "rate_limited"); continue; }
    if (response.status >= 500) { await mark(env, row, "unknown", "provider_unknown"); continue; }
    let data;
    try { data = await response.json(); } catch { await mark(env, row, "unknown", "malformed_response"); continue; }
    if (response.ok && data.ErrorCode === 0 && data.MessageID) {
      await env.REPORTING_DB.prepare("UPDATE reports SET status='accepted',lease_until=NULL,provider_message_id=?,accepted_at=?,last_error_kind=NULL WHERE learner_id=? AND period_start_day=? AND status='sending'").bind(data.MessageID, now, row.learner_id, row.period_start_day).run();
    } else {
      if (response.status === 406) await env.REPORTING_DB.prepare("UPDATE service_config SET value=0,updated_at=? WHERE key='email_enabled'").bind(now).run();
      await mark(env, row, "definitive_failure", `provider_${response.status || data.ErrorCode || "rejected"}`);
    }
  }
}

async function mark(env, row, status, kind) {
  await env.REPORTING_DB.prepare("UPDATE reports SET status=?,lease_until=NULL,last_error_kind=? WHERE learner_id=? AND period_start_day=? AND status='sending'").bind(status, kind, row.learner_id, row.period_start_day).run();
}

export async function cleanup(env, now) {
  await env.REPORTING_DB.batch([
    env.REPORTING_DB.prepare("DELETE FROM enrollment_codes WHERE expires_at<?").bind(now - 30 * 86400000),
    env.REPORTING_DB.prepare("DELETE FROM device_credentials WHERE revoked_at IS NOT NULL AND revoked_at<?").bind(now - 30 * 86400000),
    env.REPORTING_DB.prepare("DELETE FROM daily_summaries WHERE received_at<?").bind(now - 365 * 86400000),
    env.REPORTING_DB.prepare("DELETE FROM reports WHERE generated_at<?").bind(now - 400 * 86400000),
  ]);
}
