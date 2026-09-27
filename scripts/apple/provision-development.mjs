#!/usr/bin/env node
import { createPrivateKey, sign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = resolve(repoRoot, ".env");
if (existsSync(envPath)) loadEnvFile(envPath);

const apply = process.argv.includes("--apply");
const keyId = process.env.ASC_KEY_ID || process.env.APP_STORE_CONNECT_API_KEY_ID;
const deviceUDID = process.env.WORDBREAK_DEVICE_UDID;
if (!keyId || !deviceUDID) {
  throw new Error("Set ASC_KEY_ID and WORDBREAK_DEVICE_UDID in the ignored .env (see .env.example).");
}
const issuerId = process.env.ASC_ISSUER_ID || process.env.ISSUER_ID || process.env.APP_STORE_CONNECT_API_ISSUER_ID;
const keyPath = resolve(process.env.ASC_KEY_PATH || `${homedir()}/.appstoreconnect/private_keys/AuthKey_${keyId}.p8`);
if (!issuerId) throw new Error("Set ASC_ISSUER_ID or ISSUER_ID");

const b64url = (value) => Buffer.from(value).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
const payload = b64url(JSON.stringify({ iss: issuerId, iat: now, exp: now + 900, aud: "appstoreconnect-v1" }));
const signingInput = `${header}.${payload}`;
const signature = sign("sha256", Buffer.from(signingInput), { key: createPrivateKey(readFileSync(keyPath)), dsaEncoding: "ieee-p1363" }).toString("base64url");
const token = `${signingInput}.${signature}`;

async function request(method, path, body) {
  const response = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${await response.text()}`);
  return response.status === 204 ? {} : response.json();
}

async function ensureDevice() {
  const udid = deviceUDID;
  const found = (await request("GET", `/v1/devices?filter[udid]=${udid}&limit=10`)).data;
  if (found.length) return { kind: "device", state: "exists", id: found[0].id, name: found[0].attributes.name };
  if (!apply) return { kind: "device", state: "would-create", name: "Luca's iPhone" };
  const created = await request("POST", "/v1/devices", { data: { type: "devices", attributes: { name: "Luca's iPhone", platform: "IOS", udid } } });
  return { kind: "device", state: "created", id: created.data.id, name: created.data.attributes.name };
}

async function ensureBundleId(identifier, name) {
  const found = (await request("GET", `/v1/bundleIds?filter[identifier]=${encodeURIComponent(identifier)}&limit=10`)).data;
  if (found.length) return { kind: "bundleId", state: "exists", id: found[0].id, identifier };
  if (!apply) return { kind: "bundleId", state: "would-create", identifier };
  const created = await request("POST", "/v1/bundleIds", { data: { type: "bundleIds", attributes: { identifier, name, platform: "IOS" } } });
  return { kind: "bundleId", state: "created", id: created.data.id, identifier };
}

async function ensureCapability(bundleId, capabilityType) {
  if (!bundleId.id) return { kind: "capability", state: "waiting-for-bundle", capabilityType };
  const found = (await request("GET", `/v1/bundleIds/${bundleId.id}/bundleIdCapabilities`)).data;
  if (found.some((item) => item.attributes.capabilityType === capabilityType)) {
    return { kind: "capability", state: "exists", bundleId: bundleId.identifier, capabilityType };
  }
  if (!apply) return { kind: "capability", state: "would-enable", bundleId: bundleId.identifier, capabilityType };
  await request("POST", "/v1/bundleIdCapabilities", {
    data: {
      type: "bundleIdCapabilities",
      attributes: { capabilityType },
      relationships: { bundleId: { data: { type: "bundleIds", id: bundleId.id } } },
    },
  });
  return { kind: "capability", state: "enabled", bundleId: bundleId.identifier, capabilityType };
}

const device = await ensureDevice();
const app = await ensureBundleId("com.mattmireles.wordbreak", "Wordbreak Native");
const monitor = await ensureBundleId("com.mattmireles.wordbreak.screentime-monitor", "Wordbreak Screen Time Monitor");
const results = [
  device,
  app,
  monitor,
  await ensureCapability(app, "APP_GROUPS"),
  await ensureCapability(monitor, "APP_GROUPS"),
];
console.log(JSON.stringify({
  apply,
  results,
  managedCapabilityBoundary: {
    capability: "Family Controls (Distribution)",
    state: "requires-account-holder-capability-request",
    bundleIds: [app.identifier, monitor.identifier],
  },
}, null, 2));
