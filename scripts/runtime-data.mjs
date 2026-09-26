import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function extractRuntime(root, options = {}) {
  let html = readFileSync(resolve(root, options.htmlPath || "wordbreak_v2.html"), "utf8");
  if (typeof options.fieldPackOn === "boolean") {
    html = html.replace(/const FIELD_PACK_ON=(?:true|false);/, `const FIELD_PACK_ON=${options.fieldPackOn};`);
  }
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
  if (!script) throw new Error("Could not locate the inline application script");
  const app = { innerHTML: "", value: "", addEventListener() {}, focus() {}, select() {}, querySelectorAll() { return []; } };
  const storage = options.storage ?? {
    values: new Map(), failWrites: false,
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { if (this.failWrites) throw new Error("storage full"); this.values.set(key, value); },
    removeItem(key) { this.values.delete(key); },
  };
  const NativeDate = Date;
  const nowMs = options.nowMs;
  class InjectedDate extends NativeDate {
    constructor(...args) { super(...(!args.length && Number.isFinite(nowMs) ? [nowMs] : args)); }
    static now() { return Number.isFinite(nowMs) ? nowMs : NativeDate.now(); }
  }
  const randomValues = [...(options.randomValues || [17, 29, 43, 61])];
  let randomIndex = 0;
  const injectedCrypto = options.crypto ?? {
    randomUUID: () => (options.uuidValues || ["00000000-0000-4000-8000-000000000001"])[randomIndex++ % (options.uuidValues?.length || 1)],
    getRandomValues(target) { for (let i = 0; i < target.length; i++) target[i] = randomValues[(randomIndex + i) % randomValues.length]; randomIndex += target.length; return target; },
  };
  const injectedMath = Object.create(Math);
  injectedMath.random = options.random ?? (() => 0.25);
  const context = {
    console, TextEncoder, crypto: injectedCrypto, performance: options.performance ?? performance,
    Date: Number.isFinite(nowMs) ? InjectedDate : NativeDate, Math: injectedMath, app,
    Intl, structuredClone, AbortController,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0,
    location: { hash: "", pathname: "/", search: "" },
    history: { replaceState() {} },
    navigator: options.navigator ?? { onLine: false, locks: null, userAgent: "wordbreak-test", platform: "test" },
    confirm: options.confirm ?? (() => false), alert() {}, prompt: options.prompt ?? (() => null),
    document: { hidden: false, getElementById: () => app, querySelectorAll: () => [], addEventListener() {} },
    window: { addEventListener() {} },
    localStorage: storage,
    speechSynthesis: { cancel() {}, speak() {} },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    fetch: options.fetch ?? (async () => { throw new Error("unexpected fetch"); }),
  };
  context.globalThis = context;
  runInNewContext(`${script}\n;globalThis.__WB_DATA={units:UNITS,assessment:ASSESSMENT_FORMS,state:P,screen:S,app,
    runtimeHashes:typeof WORDBREAK_RUNTIME==="undefined"?null:WORDBREAK_RUNTIME,
    helpers:{assessmentNormalize,assessmentScore,assessmentShuffle,assessmentPhase,assessmentEligibility,submitAssessmentResponse,
      startAssessment,abandonAssessment,reportPagehide,compileSession,frontierUnits,dueList,blockStale,sessionValid,
      nextDueInDays,placement,fastPass,isPackUnit,isEnabledUnit,normalizeImportedProgress,reportDay,reportAdd,reportGap,
      reportCompact,reportFillDays,reportState,reportCheckpoint,reportDirty,reportCredit,recordSessionStart,recordSessionEnd,
      reportActivity,reportSample,reportPump,setReportClockForTest:(lastActivity,lastSample)=>{reportLastActivity=lastActivity;reportLastSample=lastSample},
      setDocumentHiddenForTest:(value)=>{document.hidden=!!value},
      setReportCredentialForTest:(value)=>{reportCredential=value},getReportCredentialForTest:()=>reportCredential},
    actions:{render,goHome,startSession,enterBlock,advanceSession,openDocs,openRun,startWord,commitTyped,setFlag,execute,toPatch,commitPatch,confirmDone,startAssessment,submitAssessmentResponse},
    fieldPack:{version:FIELD_PACK_VERSION,on:FIELD_PACK_ON,ids:FIELD_PACK_IDS}};`, context, { filename: "wordbreak_v2.html" });
  const data = context.__WB_DATA;
  const shouldValidate = options.validateSourceHashes ?? (options.htmlPath === undefined || options.htmlPath === "wordbreak_v2.html");
  if (shouldValidate) {
    if (!data.runtimeHashes) throw new Error("Generated browser artifact is missing runtime hashes");
    const contentSource = readFileSync(resolve(root, "src/game/wordbreak-content.js"), "utf8");
    const engineSource = readFileSync(resolve(root, "src/game/wordbreak-core.js"), "utf8");
    const expected = {
      contentHash: sha256(JSON.stringify(canonicalize({ UNITS: data.units, ASSESSMENT_FORMS: data.assessment }))),
      contentSourceHash: sha256(contentSource),
      engineHash: sha256(engineSource),
    };
    for (const [name, value] of Object.entries(expected)) {
      if (data.runtimeHashes[name] !== value) throw new Error(`Generated browser ${name} does not match authored source`);
    }
  }
  return data;
}
