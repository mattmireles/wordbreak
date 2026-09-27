#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

const root = resolve(import.meta.dirname, "../..");
const envPath = resolve(root, ".env");
if (existsSync(envPath)) loadEnvFile(envPath);
const expected = {
  team: "6ETYBAJKY8",
  deploymentTarget: "26.0",
  // Learner device identity stays out of the repo: set it in the ignored .env.
  deviceUDID: process.env.WORDBREAK_DEVICE_UDID || "unset: add WORDBREAK_DEVICE_UDID to .env",
  appBundleID: "com.mattmireles.wordbreak",
  extensionBundleID: "com.mattmireles.wordbreak.screentime-monitor",
  appGroup: "group.com.mattmireles.wordbreak",
};

const appArgument = process.argv.find((argument) => argument.startsWith("--app="));
const signedAppPath = appArgument ? resolve(appArgument.slice("--app=".length)) : null;
const failures = [];
const passes = [];

function run(command, arguments_) {
  try {
    return execFileSync(command, arguments_, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const details = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${arguments_.join(" ")} failed${details ? `:\n${details}` : ""}`);
  }
}

function check(condition, label, detail) {
  if (condition) passes.push(label);
  else failures.push(`${label}: ${detail}`);
}

function readPlist(path) {
  return JSON.parse(run("plutil", ["-convert", "json", "-o", "-", resolve(root, path)]));
}

function verifySourceEntitlements(path, label) {
  const entitlements = readPlist(path);
  check(
    entitlements["com.apple.developer.family-controls"] === true,
    `${label} requests Family Controls`,
    "com.apple.developer.family-controls must be true",
  );
  check(
    entitlements["com.apple.security.application-groups"]?.includes(expected.appGroup),
    `${label} requests the shared App Group`,
    `${expected.appGroup} is missing`,
  );
}

verifySourceEntitlements("ios/Wordbreak/Wordbreak.entitlements", "app");
verifySourceEntitlements("ios/WordbreakScreenTimeMonitor/WordbreakScreenTimeMonitor.entitlements", "extension");

const info = readPlist("ios/Wordbreak/Info.plist");
for (const key of ["NSCameraUsageDescription", "NSMicrophoneUsageDescription", "NSPhotoLibraryAddUsageDescription"]) {
  check(typeof info[key] === "string" && info[key].trim().length > 0, `${key} is present`, "usage text is missing");
}

const buildSettings = JSON.parse(run("xcodebuild", [
  "-project", "ios/Wordbreak.xcodeproj",
  "-scheme", "Wordbreak",
  "-showBuildSettings",
  "-json",
]));
const settingsByTarget = new Map(buildSettings.map((entry) => [entry.target, entry.buildSettings]));
for (const [target, bundleID] of [["Wordbreak", expected.appBundleID], ["WordbreakScreenTimeMonitor", expected.extensionBundleID]]) {
  const settings = settingsByTarget.get(target);
  check(Boolean(settings), `${target} build settings exist`, "target is missing from the generated project");
  if (!settings) continue;
  check(settings.PRODUCT_BUNDLE_IDENTIFIER === bundleID, `${target} bundle identifier`, `expected ${bundleID}, received ${settings.PRODUCT_BUNDLE_IDENTIFIER}`);
  check(settings.DEVELOPMENT_TEAM === expected.team, `${target} development team`, `expected ${expected.team}, received ${settings.DEVELOPMENT_TEAM}`);
  check(settings.IPHONEOS_DEPLOYMENT_TARGET === expected.deploymentTarget, `${target} iOS deployment target`, `expected ${expected.deploymentTarget}, received ${settings.IPHONEOS_DEPLOYMENT_TARGET}`);
}

const deviceListing = JSON.parse(run("xcrun", [
  "devicectl", "list", "devices",
  "--json-output", "-",
  "--omit-deprecated-fields-in-json",
]));
const device = deviceListing.result.devices.find(
  (candidate) => candidate.properties?.hardware?.udid === expected.deviceUDID,
);
check(Boolean(device), "Luca's exact iPhone is known to Xcode", `UDID ${expected.deviceUDID} is absent`);
check(
  device?.properties?.connection?.state === "connected"
    && device?.properties?.connection?.pairingState === "paired",
  "Luca's exact iPhone is connected and paired",
  device
    ? `state=${device.properties?.connection?.state ?? "unknown"}, pairing=${device.properties?.connection?.pairingState ?? "unknown"}`
    : "device is absent",
);
check(
  Boolean(device?.properties?.state?.developerModeStatus?.enabled),
  "Luca's exact iPhone has Developer Mode enabled",
  "Developer Mode is disabled or unavailable",
);

if (signedAppPath) {
  check(existsSync(signedAppPath), "signed app exists", signedAppPath);
  const extensionPath = resolve(signedAppPath, "PlugIns/WordbreakScreenTimeMonitor.appex");
  check(existsSync(extensionPath), "signed monitor extension exists", extensionPath);
  for (const [path, label] of [[signedAppPath, "signed app"], [extensionPath, "signed extension"]]) {
    if (!existsSync(path)) continue;
    const entitlements = run("codesign", ["-d", "--entitlements", ":-", path]);
    check(entitlements.includes("com.apple.developer.family-controls"), `${label} has Family Controls entitlement`, "the signing profile stripped Family Controls");
    check(entitlements.includes(expected.appGroup), `${label} has shared App Group entitlement`, "the signing profile stripped the App Group");
  }
} else {
  failures.push("signed entitlement inspection: pass --app=/absolute/path/Wordbreak.app after a device build");
}

console.log(`Phase 0 iOS preflight: ${passes.length} checks passed, ${failures.length} failed.`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
