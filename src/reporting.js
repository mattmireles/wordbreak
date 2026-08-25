const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BODY = 48 * 1024;
const COUNTERS = [
  "activeMs", "practiceEvents", "clean", "liveAim", "reviewEvents",
  "reviewClean", "reviewLiveAim", "sessionsStarted", "sessionsCompleted",
  "sessionsAbandoned", "bonusStarted", "bonusCompleted",
];

export function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function validOrigin(request, env) {
  const origin = request.headers.get("origin");
  return origin === "https://wordbreak.fun" || (env.DEV_ORIGIN && origin === env.DEV_ORIGIN);
}

export async function boundedJson(request, max = MAX_BODY) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > max) throw new HttpError(413, "body_too_large");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > max) throw new HttpError(413, "body_too_large");
  try { return JSON.parse(raw); } catch { throw new HttpError(400, "invalid_json"); }
}

export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

export function normalizeDay(day) {
  if (!day || typeof day !== "object" || !DAY_RE.test(day.day) || !Number.isInteger(day.revision) || day.revision < 1) {
    throw new HttpError(422, "invalid_day");
  }
  const out = { day: day.day, revision: day.revision };
  for (const key of COUNTERS) {
    if (!Number.isInteger(day[key]) || day[key] < 0) throw new HttpError(422, "invalid_day");
    out[key] = day[key];
  }
  if (out.activeMs > 86400000 || out.clean > out.practiceEvents || out.liveAim > out.practiceEvents ||
      out.reviewEvents > out.practiceEvents || out.reviewClean > out.reviewEvents ||
      out.reviewLiveAim > out.reviewEvents || out.sessionsCompleted > out.sessionsStarted ||
      out.sessionsAbandoned > out.sessionsStarted || out.bonusCompleted > out.bonusStarted) {
    throw new HttpError(422, "invalid_day");
  }
  out.modulesCleared = [...new Set(day.modulesCleared || [])].filter(x => /^\d+\.\d+$/.test(x)).sort();
  if (out.modulesCleared.length !== (day.modulesCleared || []).length) throw new HttpError(422, "invalid_modules");
  out.codes = {};
  for (const key of Object.keys(day.codes || {}).sort()) {
    if (!/^E(?:[1-9]|1[01])$/.test(key)) throw new HttpError(422, "invalid_codes");
    const row = day.codes[key];
    if (!row || ![row.seen, row.clean, row.aim].every(Number.isInteger) || row.seen < 0 || row.clean < 0 || row.aim < 0 || row.clean > row.seen || row.aim > row.seen) throw new HttpError(422, "invalid_codes");
    out.codes[key] = { seen: row.seen, clean: row.clean, aim: row.aim };
  }
  return out;
}

export function isMonotonic(next, prior) {
  if (!prior) return true;
  if (COUNTERS.some(k => next[k] < Number(prior[snake(k)]))) return false;
  const priorModules = new Set(JSON.parse(prior.modules_json));
  if ([...priorModules].some(x => !next.modulesCleared.includes(x))) return false;
  const priorCodes = JSON.parse(prior.codes_json);
  return Object.entries(priorCodes).every(([key, row]) => {
    const n = next.codes[key];
    return n && n.seen >= row.seen && n.clean >= row.clean && n.aim >= row.aim;
  });
}

function snake(key) { return key.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`); }

export function reportDay(timestamp = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(timestamp);
}
