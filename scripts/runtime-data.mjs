import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";

export function extractRuntime(root, options = {}) {
  let html = readFileSync(resolve(root, "wordbreak_v2.html"), "utf8");
  if (typeof options.fieldPackOn === "boolean") {
    html = html.replace(/const FIELD_PACK_ON=(?:true|false);/, `const FIELD_PACK_ON=${options.fieldPackOn};`);
  }
  const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)?.[1];
  if (!script) throw new Error("Could not locate the inline application script");
  const app = { innerHTML: "", addEventListener() {}, focus() {}, select() {} };
  const storage = options.storage ?? {
    values: new Map(), failWrites: false,
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { if (this.failWrites) throw new Error("storage full"); this.values.set(key, value); },
    removeItem(key) { this.values.delete(key); },
  };
  const context = {
    console, TextEncoder, crypto, performance, Intl, structuredClone, AbortController,
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
  runInNewContext(`${script}\n;globalThis.__WB_DATA={units:UNITS,assessment:ASSESSMENT_FORMS,state:P,screen:S,
    helpers:{assessmentNormalize,assessmentScore,assessmentShuffle,assessmentPhase,assessmentEligibility,submitAssessmentResponse,
      startAssessment,abandonAssessment,reportPagehide,compileSession,frontierUnits,dueList,blockStale,sessionValid,
      nextDueInDays,placement,fastPass,isPackUnit,isEnabledUnit,normalizeImportedProgress,reportDay,reportAdd,reportGap,
      reportCompact,reportFillDays,reportState,reportCheckpoint,reportDirty,reportCredit,recordSessionStart,recordSessionEnd,
      reportActivity,reportSample,reportPump,setReportClockForTest:(lastActivity,lastSample)=>{reportLastActivity=lastActivity;reportLastSample=lastSample},
      setDocumentHiddenForTest:(value)=>{document.hidden=!!value},
      setReportCredentialForTest:(value)=>{reportCredential=value},getReportCredentialForTest:()=>reportCredential},
    fieldPack:{version:FIELD_PACK_VERSION,on:FIELD_PACK_ON,ids:FIELD_PACK_IDS}};`, context, { filename: "wordbreak_v2.html" });
  return context.__WB_DATA;
}
