import assert from "node:assert/strict";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { extractRuntime } from "../scripts/runtime-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function storageFixture() {
  return {
    values: new Map(),
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, value); },
    removeItem(key) { this.values.delete(key); },
  };
}

function response(status, body = {}) {
  return { status, json: async () => body };
}

test("serialized sync acknowledges accepted daily revisions", async () => {
  let request;
  const data = extractRuntime(root, {
    navigator: { onLine: true, locks: null, userAgent: "test", platform: "test" },
    fetch: async (url, init) => {
      request = { url, init };
      const payload = JSON.parse(init.body);
      return response(200, { accepted: payload.days.map(({ day, revision }) => ({ day, revision })), rejected: [] });
    },
  });
  const day = data.helpers.reportDay();
  data.helpers.reportAdd(day, "practiceEvents", 1);
  const revision = data.state.reporting.days[day].revision;
  data.helpers.setReportCredentialForTest({ token: "private-test-token" });
  await data.helpers.reportPump();
  assert.equal(request.url, "/api/reporting/sync");
  assert.equal(request.init.headers.authorization, "Bearer private-test-token");
  assert.equal(data.state.reporting.acked[day], revision);
  assert.equal(data.helpers.reportDirty().length, 0);
});

test("a drained outbox sends an explicit coverage checkpoint", async () => {
  const payloads = [];
  const data = extractRuntime(root, {
    navigator: { onLine: true, locks: null, userAgent: "test", platform: "test" },
    fetch: async (_url, init) => {
      const payload = JSON.parse(init.body);
      payloads.push(payload);
      return response(200, { accepted: payload.days.map(({ day, revision }) => ({ day, revision })), rejected: [] });
    },
  });
  data.helpers.setReportCredentialForTest({ token: "token" });
  await data.helpers.reportPump();
  await data.helpers.reportPump();
  assert.equal(payloads.length, 2);
  assert.equal(payloads[0].days.length > 0, true);
  assert.equal(payloads[1].days.length, 0);
  assert.equal(typeof payloads[1].checkpoint.completeThroughDay, "string");
  assert.ok(Array.isArray(payloads[1].checkpoint.gaps));
});

test("a second pump cannot overlap an in-flight request", async () => {
  let resolveFetch;
  let calls = 0;
  const pending = new Promise((resolve) => { resolveFetch = resolve; });
  const data = extractRuntime(root, {
    navigator: { onLine: true, locks: null, userAgent: "test", platform: "test" },
    fetch: async () => { calls += 1; await pending; return response(200, { accepted: [], rejected: [] }); },
  });
  data.helpers.setReportCredentialForTest({ token: "token" });
  const first = data.helpers.reportPump();
  const second = data.helpers.reportPump();
  assert.equal(calls, 1);
  await second;
  resolveFetch();
  await first;
  assert.equal(calls, 1);
});

test("terminal row rejection dead-letters only that day and records incomplete coverage", async () => {
  const data = extractRuntime(root, {
    navigator: { onLine: true, locks: null, userAgent: "test", platform: "test" },
    fetch: async (_url, init) => {
      const [bucket] = JSON.parse(init.body).days;
      return response(200, { accepted: [], rejected: [{ day: bucket.day, revision: bucket.revision, error: "invalid_day" }] });
    },
  });
  const day = data.helpers.reportDay();
  data.helpers.reportAdd(day, "practiceEvents", 1);
  data.helpers.setReportCredentialForTest({ token: "token" });
  await data.helpers.reportPump();
  assert.equal(data.state.reporting.deadLetters.at(-1).day, day);
  assert.equal(data.state.reporting.deadLetters.at(-1).error, "invalid_day");
  assert.equal(data.state.reporting.gaps.some((gap) => gap.start === day && gap.reason === "terminal_rejection"), true);
  assert.equal(data.helpers.reportDirty().length, 0);
});

test("401 disconnects the reporting credential and stops automatic retries", async () => {
  const storage = storageFixture();
  storage.setItem("wb2-report-credential", JSON.stringify({ token: "expired" }));
  let calls = 0;
  const data = extractRuntime(root, {
    storage,
    navigator: { onLine: true, locks: null, userAgent: "test", platform: "test" },
    fetch: async () => { calls += 1; return response(401); },
  });
  data.helpers.setReportCredentialForTest({ token: "expired" });
  await data.helpers.reportPump();
  assert.equal(calls, 1);
  assert.equal(data.helpers.getReportCredentialForTest(), null);
  assert.equal(storage.getItem("wb2-report-credential"), null);
  await data.helpers.reportPump();
  assert.equal(calls, 1);
});

test("retryable server errors retain dirty data without fabricating acknowledgement", async () => {
  const data = extractRuntime(root, {
    navigator: { onLine: true, locks: null, userAgent: "test", platform: "test" },
    fetch: async () => response(503),
  });
  const day = data.helpers.reportDay();
  data.helpers.reportAdd(day, "practiceEvents", 1);
  data.helpers.setReportCredentialForTest({ token: "token" });
  await data.helpers.reportPump();
  assert.equal(data.helpers.reportDirty().some((bucket) => bucket.day === day), true);
  assert.equal(data.state.reporting.acked[day] ?? 0, 0);
});
