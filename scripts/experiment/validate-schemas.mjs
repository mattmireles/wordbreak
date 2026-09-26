#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const directory = resolve("experiment/schemas");
const schemaFiles = readdirSync(directory).filter((name) => name.endsWith(".schema.json")).sort();
const schemas = schemaFiles.map((name) => JSON.parse(readFileSync(resolve(directory, name), "utf8")));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
for (const schema of schemas) {
  if (!ajv.validateSchema(schema)) throw new Error(`${schema.$id}: ${ajv.errorsText(ajv.errors)}`);
  ajv.addSchema(schema);
}

const samples = [
  {
    schema: "https://wordbreak.fun/schemas/event.v1.json",
    value: { schemaVersion: 1, sessionId: "session-1", sequence: 0, hostMonotonicNs: 1000, captureSegmentId: "segment-1", segmentMediaTimeMs: 0, subject: "daily", screen: "daily.home", engineVersion: "legacy-freeze-v1", contentHash: "fixture", eventType: "sessionStarted", payload: {} },
  },
  {
    schema: "https://wordbreak.fun/schemas/capture-manifest.v1.json",
    value: { schemaVersion: 1, sessionId: "session-1", createdAt: "2026-09-22T00:00:00Z", build: { gitSha: "fixture", bundleId: "com.mattmireles.wordbreak", buildNumber: "1", engineHash: "a".repeat(64), contentHash: "b".repeat(64) }, eligibleDurationMs: 900000, segments: [{ segmentId: "segment-1", reason: "start", hostAnchorNs: 1000, firstPresentationTimeMs: 0, lastPresentationTimeMs: 900000, durationMs: 900000, discontinuities: [], thermalStates: ["nominal"] }], objects: [{ name: "raw/segments/segment-1/screen.mov", track: "screen", segmentId: "segment-1", contentType: "video/quicktime", byteCount: 1, sha256: "c".repeat(64) }], coverage: { screen: 1 }, captureComplete: true },
  },
  {
    schema: "https://wordbreak.fun/schemas/session-manifest.v1.json",
    value: { schemaVersion: 1, sessionId: "session-1", finalizedAt: "2026-09-22T00:20:00Z", captureManifest: { name: "manifest/capture-manifest.json", generation: "1", sha256: "d".repeat(64) }, objects: [{ name: "raw/segments/segment-1/screen.mov", generation: "2", byteCount: 1, sha256: "c".repeat(64) }] },
  },
];

for (const sample of samples) {
  const validate = ajv.getSchema(sample.schema);
  if (!validate?.(sample.value)) throw new Error(`${sample.schema}: ${ajv.errorsText(validate?.errors)}`);
}

console.log(`Validated ${schemas.length} JSON schemas and ${samples.length} representative artifacts.`);

