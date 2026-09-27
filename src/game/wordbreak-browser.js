"use strict";
/* Enrollment is a URL fragment so it never reaches an HTTP log. Scrub it before
   touching the DOM or either localStorage ledger. */
let REPORT_ENROLL_CODE=null;
if(location.hash.startsWith("#report-enroll=")){
  REPORT_ENROLL_CODE=decodeURIComponent(location.hash.slice(15));
  history.replaceState(null,"",location.pathname+location.search);
}
const VOWELS="aeiou";
const AUDIO_GEN="g1";
const AUDIO_VOICE="af_heart";
const AUDIO_BASE="audio/";
function normalize(text) {
  return String(text).normalize("NFC").trim().replace(/\s+/g, " ");
}
// Keep this byte-for-byte identical to scripts/audio/key.mjs.
function fnv1a32(input) {
  const bytes = new TextEncoder().encode(input);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
let curAudio=null, curObjectUrl=null, saySeq=0;
function speakFallback(text,slow){ try{ const u=new SpeechSynthesisUtterance(text);
  u.rate=slow?0.6:0.85; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch(e){} }
function say(audioText,slow,fallbackText){
  reportActivity();
  const clickSeq=++saySeq;
  const fallback=()=>speakFallback(fallbackText??audioText,slow);
  curAudio?.pause(); speechSynthesis.cancel();
  if(curObjectUrl){ URL.revokeObjectURL(curObjectUrl); curObjectUrl=null; }
  const speedTag=slow?"s":"n";
  const key=fnv1a32([AUDIO_GEN,AUDIO_VOICE,speedTag,normalize(audioText)].join("|"));
  const url=AUDIO_BASE+key+".mp3";
  let fallbackUsed=false, objectUrl=null;
  const useFallback=()=>{ if(fallbackUsed||clickSeq!==saySeq)return; fallbackUsed=true; if(objectUrl){URL.revokeObjectURL(objectUrl); if(curObjectUrl===objectUrl)curObjectUrl=null;} fallback(); };
  const play=async()=>{
    try{
      let src=url;
      if(typeof caches!=="undefined"){
        const cached=await caches.match(url);
        if(cached){ objectUrl=URL.createObjectURL(await cached.blob()); src=objectUrl; }
      }
      if(clickSeq!==saySeq){ if(objectUrl)URL.revokeObjectURL(objectUrl); return; }
      const audio=new Audio(src); curAudio=audio;
      if(objectUrl)curObjectUrl=objectUrl;
      audio.addEventListener("ended",()=>{ if(objectUrl){URL.revokeObjectURL(objectUrl); if(curObjectUrl===objectUrl)curObjectUrl=null;} });
      audio.addEventListener("error",useFallback,{once:true});
      audio.play().catch(useFallback);
    }catch(e){ useFallback(); }
  };
  play();
}
function precacheAudio(){
  if(typeof caches==="undefined"||typeof fetch==="undefined")return;
  fetch(AUDIO_BASE+"manifest.json").then(r=>r.ok?r.json():Promise.reject()).then(files=>
    caches.open(`wb-audio-${AUDIO_GEN}`).then(async cache=>{
      await cache.addAll(files.map(file=>AUDIO_BASE+file));
      try{ await navigator.storage?.persist?.(); }catch(e){}
      const names=await caches.keys();
      await Promise.all(names.filter(name=>name.startsWith("wb-audio-")&&name!==`wb-audio-${AUDIO_GEN}`).map(name=>caches.delete(name)));
    })
  ).catch(()=>{});
}
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function fmtPrompt(s){ return esc(s).replace(/([+→·?])/g,'<span class="sfx">$1</span>'); }
function renderStress(stress){ return (stress||[]).map(sg=>`<span class="seg ${sg[1]?"stress":""}">${esc(sg[0])}</span>`).join(""); }
function wireSay(){
  const root=document.getElementById("app"); if(!root) return;
  root.querySelectorAll("[data-say]").forEach(el=>{
    el.addEventListener("click",()=>say(el.getAttribute("data-say")||"", el.hasAttribute("data-slow"), el.getAttribute("data-fallback")||undefined));
  });
}
/* persistence */
const ASSESSMENT_VERSION=2;
const ASSESSMENT_ON=true;
const FIELD_PACK_VERSION=1;
const FIELD_PACK_ON=true;
const FIELD_PACK_IDS=Object.freeze(["9.1","9.2","9.3","9.4"]);
const LOG_CAP=500;
const REPORT_KEY="wb2-report-credential", REPORT_MAX_BYTES=128*1024;
const REPORT_ZONE="America/Los_Angeles";
let reportSyncTimer=null, reportSyncing=false, reportSaveFailed=false;
let reportLastActivity=performance.now(), reportLastSample=performance.now();
let reportCredential=null;
try{ reportCredential=JSON.parse(localStorage.getItem(REPORT_KEY)||"null"); }catch(e){}
let P;
try{ P=JSON.parse(localStorage.getItem("wb2"))||{}; }catch(e){ P={}; }
P.docs=P.docs||{}; P.cleared=P.cleared||{}; P.log=P.log||[];
/* session compiler state (plan 003) — additive; deleting these three keys resets the
   session layer only, leaving progress/schedule/profile untouched. cfg is observer-owned
   (budget in minutes); session is the current frozen queue+cursor or null; sessions is the
   observer history ring (per-session scalars, never block arrays — keeps each saveP small).
   v1 used a 30-minute default; v3 resets every pre-v3 30-minute setting because
   the old storage has no provenance to distinguish a default from a deliberate choice. */
const DEFAULT_SESSION_MIN=10;
const CFG_VERSION=3;
P.cfg=P.cfg||{budgetMin:DEFAULT_SESSION_MIN,v:CFG_VERSION};
if((P.cfg.v||0)<CFG_VERSION){ if(P.cfg.budgetMin===30) P.cfg.budgetMin=DEFAULT_SESSION_MIN; P.cfg.v=CFG_VERSION; }
P.session=P.session||null; P.sessions=P.sessions||[];
P.reporting=P.reporting||{version:1,sourceRevision:0,days:{},acked:{},gaps:[],deadLetters:[],legacy:null};
function freshAssessment(completed){return {version:ASSESSMENT_VERSION,assignment:null,runs:[],nonbonusCompletedTotal:completed||0};}
const completedSessions=P.sessions.filter(x=>!x.bonus&&x.status==="completed").length;
if(!P.assessment||P.assessment.version!==ASSESSMENT_VERSION||!Array.isArray(P.assessment.runs)){
  const hadAssessment=!!P.assessment;
  P.assessment=freshAssessment(completedSessions);
  if(hadAssessment)P.assessment.runs.push({id:"quarantined-"+Date.now(),status:"corrupt_noncomparable",role:"unknown",
    comparable:false,reasons:["invalid persisted assessment shape"],startedAt:Date.now(),completedAt:null,responses:[]});
}
P.assessment.nonbonusCompletedTotal=Math.max(Number(P.assessment.nonbonusCompletedTotal)||0,completedSessions);
if(P.log.length>LOG_CAP) P.log=P.log.slice(-LOG_CAP);
function reportDay(ts){
  return new Intl.DateTimeFormat("en-CA",{timeZone:REPORT_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(ts??Date.now());
}
function reportEmpty(day){ return {day,revision:0,activeMs:0,practiceEvents:0,clean:0,liveAim:0,
  reviewEvents:0,reviewClean:0,reviewLiveAim:0,sessionsStarted:0,sessionsCompleted:0,
  sessionsAbandoned:0,bonusStarted:0,bonusCompleted:0,modulesCleared:[],codes:{}}; }
function reportTouch(day){
  const r=P.reporting, d=r.days[day]||(r.days[day]=reportEmpty(day));
  r.sourceRevision++; d.revision++; return d;
}
function reportAdd(day,key,n=1){ const d=reportTouch(day); d[key]=(d[key]||0)+n; }
function reportGap(day,reason){
  if(!P.reporting.gaps.some(g=>g.start===day&&g.end===day)) P.reporting.gaps.push({start:day,end:day,reason});
}
function reportCompact(){
  const r=P.reporting, cutoff=Date.now()-60*86400000;
  Object.keys(r.days).sort().forEach(day=>{ if(Date.parse(day+"T12:00:00Z")<cutoff&&(r.acked[day]||0)>=r.days[day].revision) delete r.days[day]; });
  while(new TextEncoder().encode(JSON.stringify(r)).length>REPORT_MAX_BYTES){
    const day=Object.keys(r.days).sort().find(x=>(r.acked[x]||0)<r.days[x].revision);
    if(!day)break; reportGap(day,"local_storage_limit"); delete r.days[day]; delete r.acked[day];
  }
  r.deadLetters=r.deadLetters.slice(-20);
}
function saveP(){
  reportCompact();
  try{ localStorage.setItem("wb2",JSON.stringify(P)); reportSaveFailed=false; scheduleReportSync(); return true; }
  catch(e){
    try{ P.log=P.log.slice(-Math.floor(LOG_CAP/2)); localStorage.setItem("wb2",JSON.stringify(P)); reportSaveFailed=false; scheduleReportSync(); return true; }
    catch(e2){ reportSaveFailed=true; setTimeout(()=>alert("Wordbreak could not safely save this step. Free browser storage, then retry before continuing."),0); return false; }
  }
}
function isPackUnit(unit){return !!unit&&(unit.meta?.packVersion===FIELD_PACK_VERSION||FIELD_PACK_IDS.includes(unit.id));}
function isEnabledUnit(unit){return !!unit&&(!isPackUnit(unit)||FIELD_PACK_ON);}
function validFieldPackDescriptor(value){
  if(!value||!Number.isInteger(value.version)||!Array.isArray(value.unitIds)||value.unitIds.length<1||value.unitIds.length>32)return false;
  const ids=value.unitIds.map(String);return new Set(ids).size===ids.length&&ids.every(id=>/^\d+\.\d+$/.test(id));
}
function knownFieldPackDescriptor(value){return validFieldPackDescriptor(value)&&value.version===FIELD_PACK_VERSION&&value.unitIds.length===FIELD_PACK_IDS.length&&value.unitIds.every((id,i)=>id===FIELD_PACK_IDS[i]);}
function normalizeImportedProgress(value,now=Date.now()){
  if(!value||typeof value!=="object"||Array.isArray(value))return {ok:false,error:"invalid_progress"};
  const next=structuredClone(value), descriptor=next.fieldPack;
  if(!descriptor)return {ok:true,state:next};
  if(!validFieldPackDescriptor(descriptor))return {ok:false,error:"invalid_field_pack_descriptor"};
  if(knownFieldPackDescriptor(descriptor))return {ok:true,state:next};
  const quarantine=next.quarantine&&typeof next.quarantine==="object"?next.quarantine:{}, entries=Array.isArray(quarantine.fieldPacks)?quarantine.fieldPacks:[];
  if(entries.length>=4)return {ok:false,error:"field_pack_quarantine_full"};
  const ids=new Set(descriptor.unitIds), docs={},cleared={},sched={},reportingModules={};
  next.docs=next.docs&&typeof next.docs==="object"?next.docs:{};next.cleared=next.cleared&&typeof next.cleared==="object"?next.cleared:{};next.sched=next.sched&&typeof next.sched==="object"?next.sched:{};
  for(const id of ids){if(Object.hasOwn(next.docs,id)){docs[id]=next.docs[id];delete next.docs[id];}if(Object.hasOwn(next.cleared,id)){cleared[id]=next.cleared[id];delete next.cleared[id];}}
  for(const [key,event] of Object.entries(next.sched)){if(ids.has(event?.unit)){sched[key]=event;delete next.sched[key];}}
  let session=null;
  const blocks=next.session&&Array.isArray(next.session.blocks)?next.session.blocks:[];
  const touchesPack=blocks.some(block=>ids.has(block.id)||ids.has(sched[block.key]?.unit));
  if(touchesPack){session=structuredClone(next.session);const sessionId=next.session.id;next.session.status="abandoned";next.session.endedAt=now;next.session.reason="unknown_pack_version";
    const row=Array.isArray(next.sessions)?next.sessions.find(x=>x.id===sessionId):null;if(row){row.status="abandoned";row.endedAt=now;row.reason="unknown_pack_version";row.revision=(row.revision||1)+1;}next.session=null;}
  if(next.reporting?.days&&typeof next.reporting.days==="object")for(const [day,bucket] of Object.entries(next.reporting.days)){
    if(!Array.isArray(bucket.modulesCleared))continue;const removed=bucket.modulesCleared.filter(id=>ids.has(id));if(removed.length){reportingModules[day]=removed;bucket.modulesCleared=bucket.modulesCleared.filter(id=>!ids.has(id));}}
  entries.push({version:descriptor.version,unitIds:descriptor.unitIds.slice(),quarantinedAt:now,docs,cleared,sched,session,reportingModules});
  next.quarantine={...quarantine,fieldPacks:entries};delete next.fieldPack;
  return {ok:true,state:next,quarantined:true};
}
function reportFillDays(){
  const r=P.reporting, today=reportDay(), keys=Object.keys(r.days).sort();let changed=false;
  let cursor=keys.length?new Date(keys[keys.length-1]+"T12:00:00Z"):new Date(today+"T12:00:00Z");
  const end=new Date(today+"T12:00:00Z");
  while(cursor<=end){ const day=reportDay(cursor.getTime()); if(!r.days[day]){reportTouch(day);changed=true;} cursor.setUTCDate(cursor.getUTCDate()+1); }
  return changed;
}
reportFillDays();
/* hot test */
function isHot(w,typed,idx){
  const h=w.hot, ch=(typed[idx]||"").toLowerCase();
  if(!ch) return false;
  if(h.ix) return h.ix.includes(idx);            /* explicit dead-byte cells — the tightest aim spec */
  if(h.v){ if(!VOWELS.includes(ch)) return false; if(idx<(h.m||0)) return false;
    if(idx===typed.length-1&&ch==="e") return false; return true; }
  if(idx<(h.m||0)) return false;
  return !!(h.c && h.c.includes(ch));
}
const {UNITS, ASSESSMENT_FORMS}=createWordbreakContent(ASSESSMENT_VERSION);
/* ===================== SPACED RETRIEVAL — THE DUE QUEUE ===================== */
/* the load-bearing addition: cleared words come back on a widening interval, missed
   words come back tomorrow. day nine stops depending on the kid re-opening a module. */
P.sched=P.sched||{};                        /* keyed by "unitId|word" — see scheduleWord() */
const DAY=86400000;
/* Sessions, history, and the SRS all use the local calendar day. UTC midnight lands
   mid-afternoon US time, inside the practice window, so a UTC SRS day made a box-1 word's
   first review slip a day depending on whether it was practised before or after ~5 PM.
   Stored due/last values from the old UTC day are read as local days (at most one day
   late west of UTC); the shared core (wordbreak-core.js dayNumber) applies the same rule. */
function localDay(){ return Math.floor((Date.now()-new Date().getTimezoneOffset()*60000)/DAY); }
function today(){ return localDay(); }
const BOX_DAYS=[1,3,9,21,45];                           /* Leitner intervals, anchored on the day-nine beat */
const REVIEW_CAP=12;                                    /* legacy per-batch cap — retired on the session path (plan 003) */
/* session compiler tunables (plan 003). the SEC_* estimates only SIZE the compile — they are
   crude on purpose (calibration targets, not promises), and nothing kid-facing shows a clock.
   SESSION_ON is the full-path kill switch: false → the entire pre-plan home + flows return. */
const SEC_REV=60, SEC_PANEL=30, SEC_WORD=90;
const REVIEW_BLOCKS_PER_SESSION=4;                       /* enough spacing practice to matter, never a review wall */
const SESSION_QUEUE_VERSION=2;                            /* old frozen queues predate the short-session contract */
const SESSION_ON=true;
/* weight = how hard the code is to automate → how eagerly the queue resurfaces it.
   memory (E11) and schwa (E1/E2) sit at the top; foundation (E0/E3) at the bottom. */
const ERR_WEIGHT={E11:6,E1:5,E2:5,E5:4,E8:4,E7:3,E10:3,E9:3,E6:2,E4:2,E3:1,E0:0};
/* every unit literal in UNITS carries err:"EX" (from methodology.md's own unit tables) —
   this backfills it onto every word so codes ride the whole curriculum, not a decorative few.
   per-word err (already hand-set on stage 5–6 words) overrides. */
function resolveErrCodes(){
  UNITS.forEach(u=>{ u.words.forEach(w=>{ w.err=w.err||u.err||"E0"; }); });
}
/* the P.sched key: unit+word, not word alone — the same spelling is deliberately reused
   across stages (e.g. "support" in 4.1's plain seam vs 5.5's assimilation arithmetic) to
   teach two different lessons. a bare-word key would let clearing the easier one silently
   overwrite which lesson the review queue resurfaces for the other. extracted (plan 003)
   so the session compiler reconstructs the exact same key without duplicating the string. */
function schedKey(u,w){ return u.id+"|"+w.a.toLowerCase(); }
function scheduleWord(w,firstClean){
  const k=schedKey(S.unit,w);
  const e=P.sched[k]||{box:0,lapses:0,seen:0,unit:S.unit.id,word:w.a.toLowerCase()};
  const sameDayReplay=e.last===today();
  e.seen++;
  if(firstClean){
    /* a same-day replay (replaying a fresh or just-cleared module) isn't real spacing —
       advancing the box on it would reward massed repetition with a long interval it
       never earned. a fault still always resets, regardless of timing. */
    if(!sameDayReplay) e.box=Math.min(e.box+1,BOX_DAYS.length-1);
  }
  else { e.lapses++; e.box=0; }                        /* a fault drops it to the front of the queue */
  e.last=today(); e.due=today()+BOX_DAYS[e.box];
  P.sched[k]=e;
}
function dueList(){
  const t=today(), out=[];
  for(const k in P.sched){
    const e=P.sched[k]; if(e.due>t) continue;
    const u=UNITS.find(x=>x.id===e.unit); if(!isEnabledUnit(u)) continue;
    const w=u.words.find(x=>x.a.toLowerCase()===e.word); if(!w) continue;
    out.push({u,w,e});
  }
  out.sort((a,b)=> (a.e.due-b.e.due)                    /* most overdue first */
    || ((ERR_WEIGHT[b.w.err]||0)-(ERR_WEIGHT[a.w.err]||0))  /* then heaviest error type — #2's weighting */
    || (b.e.lapses-a.e.lapses));
  return out;
}
/* ===================== MEASURED ABILITY PROFILE (per error-code, shadow) ===================== */
/* a decayed-Beta θ per error code, fed by every graded encounter. drives the Continue
   target, fast-pass, and the observer panel — never the SRS interval (that stays firstClean). */
P.codes=P.codes||{};                 /* {code:{a,b,seen}} — uniform prior {1,1,0}, lazily created */
P.codesV=P.codesV||0;                /* one-time backfill version marker */
const LAMBDA=0.92;                   /* decay → effective memory ~12.5 encounters */
const THETA_LO=0.40, THETA_HI=0.75;  /* lock-arm / solid boundaries */
const N_GATE=3, N_SOLID=4;           /* min encounters to arm a lock / to go solid */
const LAT_W=0;                       /* latency weight — captured (Phase 1) but unused on the general path */
const clampS=(x)=>Math.max(0,Math.min(1,x));
function gradeEncounter(e){
  if(e.clean) return e.aim?0.92:0.80;              /* clean build: no patch occurred, bonuses N/A */
  let s=e.aim?0.30:0.15;                            /* faulted build */
  if(e.aim&&(e.tries||0)<=1&&!e.revealed) s+=0.10; /* self-patched in one */
  if(e.revealed) s-=0.07;                          /* needed the answer shown */
  return clampS(s);                                /* latency term disabled in v1 (LAT_W=0) */
}
function theta(c){ const p=P.codes[c]; return p?p.a/(p.a+p.b):0; }
function nEff(c){ const p=P.codes[c]; return p?p.a+p.b:0; }
function codeVariance(c){ const p=P.codes[c]; if(!p)return 0; const a=p.a,b=p.b,n=a+b; return (a*b)/(n*n*(n+1)); }
function updateCode(code,s){
  const p=P.codes[code]||{a:1,b:1,seen:0};
  p.a=p.a*LAMBDA+s; p.b=p.b*LAMBDA+(1-s); p.seen++; /* monotonic seen — never a log scan */
  P.codes[code]=p;
}
function onEncounter(e){ if(!e||!e.err||e.err==="E0")return; updateCode(e.err,gradeEncounter(e)); }
function codeProfile(){
  return Object.keys(P.codes).map(c=>{
    const th=theta(c), seen=P.codes[c].seen;
    const band=seen<N_GATE?"measuring":th<THETA_LO?"weak":th>=THETA_HI?"solid":"frontier";
    return {code:c,theta:th,nEff:nEff(c),seen,band};
  });
}
if(P.codesV<1){                      /* backfill: warm the profile from history, updateCode only (never scheduleWord) */
  for(const ev of P.log) onEncounter(ev);
  P.codesV=1; saveP();
}
/* ===================== PLACEMENT — THE FRONT DOOR ===================== */
const PLACEMENT_ON=true;             /* kill switch: false → old START-HERE copy + fast-pass off */
const CODE_PREREQ={E8:["E7"],E5:["E8"],E1:["E8"],E2:["E8"],E9:["E7"]};
const UNIT_PREREQ={"8.1":["E8","E5","E1","E2"]};   /* monster decomp needs 4+5+6 */
function codeBroken(c){ const p=P.codes[c]; return !!p&&p.seen>=N_GATE&&theta(c)<THETA_LO; }
function codeSolid(c){ const p=P.codes[c]; return !!p&&p.seen>=N_SOLID&&theta(c)>=THETA_HI; }
function unitLocked(u){
  if(!isEnabledUnit(u))return true;
  if(u.err==="E0")return false;
  return (UNIT_PREREQ[u.id]||CODE_PREREQ[u.err]||[]).some(codeBroken);
}
function fastPass(u){ return !P.cleared[u.id]&&!unitLocked(u)&&u.err!=="E0"&&codeSolid(u.err); }
function idKey(u){ const m=(u.id.split(".")[1]||""); return [u.st,parseInt(m,10)||0,m.replace(/^\d+/,"")]; }
function cmpUnits(a,b){ const x=idKey(a),y=idKey(b); return (x[0]-y[0])||(x[1]-y[1])||(x[2]<y[2]?-1:x[2]>y[2]?1:0); }
function placement(){
  const cand=UNITS.filter(u=>isEnabledUnit(u)&&!P.cleared[u.id]&&!unitLocked(u)).sort(cmpUnits);
  if(cand.length) return {recommend:cand[0],mode:"unit"};
  return {recommend:null,mode:dueList().length?"review":"allclear"};
}
function continueBlock(){
  if(!PLACEMENT_ON) return `<div class="card quiet"><div class="eyebrow"><span class="n">›</span> START HERE</div><div class="cluetext">begin with stage 1. Learn the move first; then practice it.</div></div>`;
  const pl=placement();
  if(pl.mode==="unit"){
    const u=pl.recommend, learned=!!P.docs[u.id], fp=fastPass(u);
    return `<div class="card" style="border-color:var(--amber);background:#1a1712">
      <div class="eyebrow"><span class="n">›</span> CONTINUE</div>
      <div class="cluetext">pick up at the frontier — the tool tracks where you are, so you don't pick a stage.${fp?` <span style="color:var(--green)">you own this pattern; one clean build clears the module.</span>`:""}</div>
      <div class="navrow" style="margin-top:8px"><button class="primary" onclick="continueGo()">▶ continue — ${esc(u.id)} · ${esc(u.nm)} · ${learned?"practice":"learn"}</button><div class="spacer"></div></div></div>`;
  }
  if(pl.mode==="review") return `<div class="card quiet"><div class="eyebrow"><span class="n">›</span> ALL CAUGHT UP</div><div class="cluetext">every module cleared. the due queue above is the work now — resurface it.</div></div>`;
  return `<div class="card quiet"><div class="eyebrow"><span class="n">›</span> ALL CLEAR</div><div class="cluetext">every module cleared and nothing due. come back when the queue refills.</div></div>`;
}
function continueGo(){ const pl=placement(); if(!pl.recommend){ if(dueList().length)startReview(); return; } const u=pl.recommend; if(!P.docs[u.id])openDocs(u.id); else openRun(u.id); }
/* ===================== SESSION COMPILER — THE ONE DOOR ===================== */
/* compileSession() is PURE: it reads P and writes nothing. Only startSession() (Phase 2)
   persists a compiled session. The home TODAY-card preview relies on this purity — it
   dry-runs the compiler at render time and must not mutate anything. */
function modPanelCells(u){ return P.docs[u.id]?0:u.docs.length; }   /* unread lesson panels, snapshotted at compile */
function modCells(u){ return modPanelCells(u)+(fastPass(u)?1:u.words.length); }
function estMod(u){ return (P.docs[u.id]?0:u.docs.length*SEC_PANEL)+(fastPass(u)?1:u.words.length)*SEC_WORD; }
function synthBlocks(){ return []; }   /* tier 3 slot — named but empty in v1 (no filler; a short session is honest) */
function frontierUnits(session){       /* uncleared, unlocked, enabled, not already queued — placement's own order */
  const have=new Set((session&&session.blocks||[]).filter(b=>b.k==="mod").map(b=>b.id));
  return UNITS.filter(u=>isEnabledUnit(u)&&!P.cleared[u.id]&&!unitLocked(u)&&!have.has(u.id)).sort(cmpUnits);
}
function compileSession(budgetMin,opts){
  const bonus=!!(opts&&opts.bonus), budgetSec=budgetMin*60;
  const blocks=[]; let est=0;
  if(bonus){                           /* appetite valve: exactly one frontier module, no reviews, budget ignored */
    const cand=frontierUnits({blocks});
    if(cand.length){ const u=cand[0]; blocks.push({k:"mod",id:u.id,cells:modCells(u),pc:modPanelCells(u)}); }
  } else {
    /* Lead with one frontier module whenever one exists: completing it moves the visible
       map forward. Reviews still matter, but a backlog must not turn the only start button
       into a long, scoreless-looking wall of old work. */
    const frontier=frontierUnits({blocks});
    if(frontier.length){
      const u=frontier.shift();
      blocks.push({k:"mod",id:u.id,cells:modCells(u),pc:modPanelCells(u)});
      est+=estMod(u);
    }
    /* A small review dose follows. The budget remains a time guard; the hard cap makes a
       long absence resumable instead of assigning the entire backlog at once. */
    let reviews=0;
    for(const d of dueList()){
      if(est>=budgetSec||reviews>=REVIEW_BLOCKS_PER_SESSION) break;
      blocks.push({k:"rev",key:schedKey(d.u,d.w),cells:1});
      est+=SEC_REV;
      reviews++;
    }
    /* A longer observer-selected budget can include more modules, but the first is always
       the visible win and the review dose above never grows into the session itself. */
    for(const u of frontier){
      if(est+estMod(u)>budgetSec) break;                 /* only the first module may cross the budget line */
      blocks.push({k:"mod",id:u.id,cells:modCells(u),pc:modPanelCells(u)});
      est+=estMod(u);
    }
  }
  blocks.push(...synthBlocks());       /* tier 3 — empty in v1 */
  return {v:SESSION_QUEUE_VERSION,id:crypto.randomUUID(),day:localDay(),startReportDay:reportDay(),startedAt:Date.now(),
    status:"in_progress",revision:1,activeMs:0,budgetMin,blocks,idx:0,done:false,bonus,
    baseDone:bonus,stats:{words:0,clean:0}};
}
/* staleness (decision 4): a compiled block no longer actionable on resume. entries are
   UPDATED in place by scheduleWord, never deleted — so a completed review's block is stale
   because its e.due is now in the future (e.due > today()), not because the key vanished. */
function blockStale(b){
  if(b.k==="rev"){
    const e=P.sched[b.key]; if(!e) return true;
    const u=UNITS.find(x=>x.id===e.unit); if(!u) return true;
    const w=u.words.find(x=>x.a.toLowerCase()===e.word); if(!w) return true;
    return e.due>today();
  }
  if(b.k==="mod"){ const u=UNITS.find(x=>x.id===b.id); return !isEnabledUnit(u)||!!P.cleared[b.id]; }
  return true;
}
function nextLiveIdx(s){ let i=s.idx; while(i<s.blocks.length&&blockStale(s.blocks[i])) i++; return i; }
function sessionValid(s){ return !!(s&&s.v===SESSION_QUEUE_VERSION&&s.day===localDay()&&!s.done&&nextLiveIdx(s)<s.blocks.length); }
/* ===================== ENGINE ===================== */
const STAGES=[
{n:1,t:"anglo-saxon foundation",d:"base layer — for other players (or speed-run it)"},
{n:2,t:"the morpheme frame",d:"doubling · drop-e · y-to-i — mandatory for everyone"},
{n:3,t:"prefixes",d:"clean seams, fast wins"},
{n:4,t:"latin roots",d:"the generative engine — warm up here"},
{n:5,t:"the double-letter decoder",d:"assimilated prefixes — the crown jewel"},
{n:6,t:"the schwa frontier",d:"the anchor & the restore — the real work"},
{n:7,t:"greek combining forms",d:"the origin signals"},
{n:8,t:"synthesis & hard cases",d:"capstone"}];
const FIELD_STAGE={n:9,t:"next field pack",d:"four fixed spelling moves — unlocks after the core"};
function visibleStages(){return FIELD_PACK_ON?[...STAGES,FIELD_STAGE]:STAGES;}
let S={screen:"home",openStage:null,unit:null,docsIdx:0,ketsuPick:null,ketsuTyped:false,
  mode:"module",queue:[],qIdx:0,
  wordIdx:0,phase:"type",typed:"",flagIdx:null,aimGood:false,firstClean:false,walkAnyway:false,
  condQ:0,condPicks:{},lineupSpent:{},witnessFound:false,memPhase:"study",
  patchTries:0,reveal:false,log:[],runGen:0,
  tShown:0,latency:null,fastPass:false,fastCleared:false,
  session:false,docsReadOnly:false,assessmentAudioBusy:false,assessmentPagehideRecorded:false};   /* session=inside the compiled session flow; docsReadOnly=map's reference-only lesson (plan 003, decision 12) */
let wordbreakCoreSession=null;
let condTimer=null;
const app=document.getElementById("app");
function html(s){ app.innerHTML=s; }
function titlebar(path){ return `<div class="titlebar"><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div><div class="path">~/wordbreak/<b>${path}</b></div></div>`; }
function clearedCount(){ return UNITS.filter(u=>isEnabledUnit(u)&&P.cleared[u.id]).length; }
function enabledUnitCount(){ return UNITS.filter(isEnabledUnit).length; }
/* ---------- HOME ---------- */
/* one-line factual preview of a block list, e.g. "4.2 · duc.family, then 4 bytes due".
   describes what the compiler assembled — no clock, no promise (README §7). */
function describeBlocks(blocks){
  const revs=blocks.filter(b=>b.k==="rev").length;
  const mods=blocks.filter(b=>b.k==="mod");
  const parts=[];
  if(mods.length){ const u=UNITS.find(x=>x.id===mods[0].id), extra=mods.length-1;
    parts.push(`${esc(mods[0].id)}${u?" · "+esc(u.nm):""}${extra>0?` (+${extra} more)`:""}`); }
  if(revs) parts.push(`${revs} ${revs===1?"byte":"bytes"} due`);
  return parts.length?parts.join(", then "):"nothing queued";
}
/* the map, read-only: id · name · description, CLEARED status, and a ghost "docs" link that
   re-opens a learned lesson for reference (decision 9). NO learn/practice buttons — the session
   is the only way in. */
function mapRows(){
  let rows="";
  for(const st of visibleStages()){
    const units=UNITS.filter(u=>isEnabledUnit(u)&&u.st===st.n);
    const done=units.filter(u=>P.cleared[u.id]).length;
    const open=S.openStage===st.n;
    let inner="";
    if(open){
      inner=units.map(u=>{
        const cleared=!!P.cleared[u.id], docsRead=!!P.docs[u.id];
        return `<div class="modrow">
          <div class="modname"><span class="uid">${u.id}</span>${esc(u.nm)}</div>
          <div class="moddesc">${esc(u.ds)}</div>
          ${cleared?`<span class="status done">CLEARED</span>`:``}
          ${docsRead?`<button class="small" onclick="openDocs('${u.id}',{readOnly:true})">docs</button>`:``}
        </div>`;}).join("");
    }
    rows+=`<div class="card quiet">
      <div class="stagehead" onclick="togStage(${st.n})">
        <span class="sn">STAGE ${st.n}</span><span class="st">${esc(st.t)}</span>
        <span class="sd">${esc(st.d)}</span>
        <span class="sd">${done}/${units.length}</span><span class="tog">${open?"▾":"▸"}</span>
      </div>${inner?`<div style="margin-top:10px">${inner}</div>`:""}</div>`;
  }
  return rows;
}
/* the single TODAY card — the only startable surface (decision 1). four states: resume an
   in-progress session, a completed day (with the bonus valve), a fresh start, or all-clear. */
function todayCard(){
  const s=P.session, completedToday=s&&s.v===SESSION_QUEUE_VERSION&&s.day===localDay()&&(s.done||s.baseDone), resumable=sessionValid(s);
  const wrap=(eyebrow,body,btn)=>`<div class="card" style="border-color:var(--amber);background:#1a1712">
    <div class="eyebrow"><span class="n">›</span> ${eyebrow}</div>
    <div class="cluetext">${body}</div>
    ${btn?`<div class="navrow" style="margin-top:8px">${btn}<div class="spacer"></div></div>`:""}</div>`;
  const leftNow=dueList().length, nd=nextDueInDays();
  const ret = leftNow ? `<b style="color:var(--amber)">${leftNow} ${leftNow===1?"byte":"bytes"}</b> still due`
    : nd!==null ? `next bytes return in <b>${nd} ${nd===1?"day":"days"}</b>` : `the frontier is the work now`;
  if(completedToday){
    const frontierLeft=frontierUnits({blocks:[]}).length;
    const btn = resumable ? `<button class="primary" onclick="startSession()">▶ resume</button>`
      : frontierLeft ? `<button class="primary" onclick="startSession(true)">one more module ▶</button>` : ``;
    return wrap("TODAY — COMPLETE", `today's session is done. ${ret}. that return is where spelling sticks — not the first clear.`, btn);
  }
  if(resumable){
    const remaining=describeBlocks(s.blocks.slice(nextLiveIdx(s)));
    return wrap("TODAY — IN PROGRESS", `you're partway through: ${remaining}.`, `<button class="primary" onclick="startSession()">▶ resume</button>`);
  }
  const pv=compileSession(P.cfg.budgetMin);   /* pure dry-run for the preview (Phase 1 purity) */
  if(!pv.blocks.length) return wrap("TODAY — ALL CLEAR", `nothing due, every module cleared. ${nd!==null?`next bytes return in <b>${nd} ${nd===1?"day":"days"}</b>`:`come back when the queue refills`}.`, ``);
  return wrap("TODAY", `${describeBlocks(pv.blocks)}. clear a new module, then make a few old bytes stick.`, `<button class="primary" onclick="startSession()">▶ start</button>`);
}
function renderHome(){
  if(!SESSION_ON) return renderHomeLegacy();
  html(`${titlebar("main")}
  <h1 class="big">WORDBREAK<span class="cursor"></span></h1>
  <div class="sub">english is legacy code. find the byte you don't trust, pull the source. // v0.2 — ${FIELD_PACK_ON?"core + field pack":"core build"}, ${enabledUnitCount()} modules</div>
  ${todayCard()}
  <div class="eyebrow" style="margin:22px 2px 8px"><span class="n">›</span> THE MAP // CORE · 8 STAGES${FIELD_PACK_ON?" + NEXT FIELD PACK":""} — read only</div>
  ${mapRows()}
  <div class="navrow"><button class="ghost" onclick="openDebrief()">session log — for the observer →</button></div>
  <div class="footer">wordbreak v0.2 // teach → flag → interrogate → patch // ${clearedCount()}/${enabledUnitCount()} modules cleared</div>`);
}
/* legacy home — restored verbatim when SESSION_ON=false (kill switch, decision 13) */
function renderHomeLegacy(){
  let rows="";
  for(const st of visibleStages()){
    const units=UNITS.filter(u=>isEnabledUnit(u)&&u.st===st.n);
    const done=units.filter(u=>P.cleared[u.id]).length;
    const open=S.openStage===st.n;
    let inner="";
    if(open){
      inner=units.map(u=>{
        const docsRead=!!P.docs[u.id], cleared=!!P.cleared[u.id];
        return `<div class="modrow">
          <div class="modname"><span class="uid">${u.id}</span>${esc(u.nm)}</div>
          <div class="moddesc">${esc(u.ds)}</div>
          ${cleared?`<span class="status done">CLEARED</span>`:docsRead?`<span class="status">LEARNED</span>`:``}
          <button class="small" onclick="openDocs('${u.id}')">learn</button>
          <button class="small primary" ${docsRead?"":"disabled"} onclick="openRun('${u.id}')" title="${docsRead?"":"learn the move first"}">practice</button>
        </div>`;}).join("");
    }
    rows+=`<div class="card quiet">
      <div class="stagehead" onclick="togStage(${st.n})">
        <span class="sn">STAGE ${st.n}</span><span class="st">${esc(st.t)}</span>
        <span class="sd">${esc(st.d)}</span>
        <span class="sd">${done}/${units.length}</span><span class="tog">${open?"▾":"▸"}</span>
      </div>${inner?`<div style="margin-top:10px">${inner}</div>`:""}</div>`;
  }
  const due=dueList();
  const dueCard = due.length ? `<div class="card" style="border-color:var(--amber);background:#1a1712">
    <div class="eyebrow"><span class="n">›</span> DUE FOR REVIEW</div>
    <div class="cluetext"><b style="color:var(--amber)">${due.length} ${due.length===1?"byte":"bytes"}</b> came back around — words you missed, plus cleared ones on their widening return (${BOX_DAYS.slice(0,-1).join("·")} days out). this is where spelling actually sticks — not the first clear.</div>
    <div class="navrow"><button class="primary" onclick="startReview()">resurface ${Math.min(due.length,REVIEW_CAP)} →</button><div class="spacer"></div>
      <span class="cluetext" style="font-size:11px">queued most-overdue-first, ties broken by error weight · a fixed curriculum with a spaced return, not yet a fully adaptive engine</span></div>
  </div>` : "";
  html(`${titlebar("main")}
  <h1 class="big">WORDBREAK<span class="cursor"></span></h1>
  <div class="sub">english is legacy code. learn the move, find the byte you don't trust, pull the source. // v0.2 — full build, 48 modules</div>
  ${dueCard}
  ${continueBlock()}
  <div class="eyebrow" style="margin:22px 2px 8px"><span class="n">›</span> BROWSE ALL STAGES</div>
  ${rows}
  <div class="navrow"><button class="ghost" onclick="openDebrief()">session log — for the observer →</button></div>
  <div class="footer">wordbreak v0.2 // teach → flag → interrogate → patch // ${clearedCount()}/48 modules cleared</div>`);
}
function togStage(n){ S.openStage=(S.openStage===n)?null:n; render(); }
/* ---------- DOCS ---------- */
/* opts.session → this open is a session block (keep S.session true). opts.readOnly → the map's
   reference-only lesson (no run hand-off). Default (no opts) is the legacy/map entry: both flags
   off. This is the single owner of the flag lifecycle (plan 003, decision 12) — every entry sets
   both flags, so a read-only lesson or a session can never leak into the next flow.
   S.ketsuMiss resets per lesson so the closing exercise's reveal-after-3 escape hatch starts fresh. */
function openDocs(id,opts){ opts=opts||{}; const unit=UNITS.find(u=>u.id===id); if(!isEnabledUnit(unit))return goHome(); S.session=!!opts.session; S.docsReadOnly=!!opts.readOnly;
  S.unit=unit; S.screen="docs"; S.docsIdx=0; S.ketsuPick=null; S.ketsuTyped=false; S.ketsuMiss=0; render(); }
function renderDocs(){
  const u=S.unit, i=S.docsIdx, p=u.docs[i], last=i===3;
  let inner=`<div class="panelstep"><b>${esc(p.s)}</b> &nbsp;·&nbsp; ${esc(u.id)} ${esc(u.nm)} — panel ${i+1}/4</div>
  <div class="brieftitle">${esc(p.t)}</div><div class="briefbody">${p.b||""}</div>`;
  if(last){
    const q=p.q;
    inner+=`<div class="briefbody"><p style="margin-top:12px">${esc(q.p)}</p></div><div style="margin-top:6px">`+
      q.o.map((o,j)=>{
        let cls="choice";
        if(S.ketsuPick!==null&&j===S.ketsuPick) cls+=(j===q.c?" picked-right":" picked-wrong");
        return `<button class="${cls}" onclick="ketsuPick(${j})">${esc(o)}</button>`;}).join("")+`</div>`;
    if(S.ketsuPick!==null){
      inner+=`<div class="term"><div class="ln ${S.ketsuPick===q.c?"ok":"bad"}">${S.ketsuPick===q.c?"✓":"✗"} ${esc(q.fb)}</div></div>`;
      if(S.ketsuPick===q.c&&!S.ketsuTyped){
        inner+=`<div class="cluetext">now build it — the lesson closes with your fingers, not your eyes:</div>
        <div class="kcue">${esc(p.cue||"")}</div>
        <div class="inputrow"><input type="text" id="ktype" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="type the word">
        <button class="primary" onclick="ketsuType()">commit</button></div><div id="kmsg"></div>`;
      }
      /* seam removal (decision 5): in a session the lesson flows straight into the run — no
         "practice is open" verdict that reads as a finish line. read-only reference reads the same. */
      if(S.ketsuTyped) inner+=`<div class="verdict good">✓ ${esc(p.ty)} — ${S.session||S.docsReadOnly?"committed.":"lesson learned. practice is open."}</div>`;
    }
  }
  const head = S.session
    ? `${titlebar("session")}\n  ${sessionStrip()}`
    : `${titlebar(u.id+"/learn")}\n  <div class="progress">${u.docs.map((d,j)=>`<span class="${j===i?"lit":""}">■</span>`).join(" ")} &nbsp; LEARN // ${esc(u.ti)}</div>`;
  /* final advance: session → next → into the run (same block, cursor unmoved); read-only → close;
     legacy → start practice. non-final panels just page forward. */
  const advance = !last ? `<button class="primary" onclick="S.docsIdx++;render()">next →</button>`
    : !S.ketsuTyped ? ``
    : S.docsReadOnly ? `<button class="primary" onclick="goHome()">close ▶</button>`
    : S.session ? `<button class="primary" onclick="openRun('${u.id}',{session:true})">next →</button>`
    : `<button class="primary" onclick="openRun('${u.id}')">start practice →</button>`;
  html(`${head}
  <div class="card">${inner}</div>
  <div class="navrow">
    ${S.session?``:`<button class="ghost" onclick="goHome()">← close lesson</button>`}<div class="spacer"></div>
    ${i>0?`<button onclick="S.docsIdx--;render()">← back</button>`:""}
    ${advance}
  </div>`);
  const inp=document.getElementById("ktype"); if(inp){ inp.focus(); inp.addEventListener("keydown",e=>{if(e.key==="Enter")ketsuType();}); }
}
function ketsuPick(j){ S.ketsuPick=j; render(); }
function ketsuType(){
  const inp=document.getElementById("ktype"); if(!inp)return;
  const v=inp.value.trim().toLowerCase(), target=S.unit.docs[3].ty.toLowerCase();
  if(v===target){ S.ketsuTyped=true; P.docs[S.unit.id]=true; saveP(); render(); }
  else{
    /* three misses and the answer is shown once, then taken away — same escape hatch
       as PATCH. it is never the first response: the cue has to fail on its own first. */
    S.ketsuMiss=(S.ketsuMiss||0)+1;
    const msg=S.ketsuMiss>=3
      ? `✗ here it is once: <b>${esc(target)}</b> — now cover it and type it.`
      : `✗ not yet — re-read the build above and run it again.`;
    document.getElementById("kmsg").innerHTML=`<div class="term"><div class="ln bad">${msg}</div></div>`;
    inp.select();
  }
}
/* ---------- RUN ---------- */
function openRunLegacy(id,opts){ opts=opts||{}; const u=UNITS.find(x=>x.id===id); if(!isEnabledUnit(u)||!P.docs[id])return goHome();
  S.session=!!opts.session; S.docsReadOnly=false;             /* flag owner (decision 12); run is never read-only */
  S.mode="module"; S.unit=u; S.screen="run"; S.wordIdx=0; S.log=[];
  S.fastPass=PLACEMENT_ON&&fastPass(u); S.fastCleared=false;   /* snapshot at open — a mid-run θ change can't move the bar */
  startWord(); }
function startReview(){
  const q=dueList().slice(0,REVIEW_CAP);
  if(!q.length){ render(); return; }
  S.session=false;                                          /* legacy path — never a session (decision 12) */
  S.mode="review"; S.queue=q; S.qIdx=0; S.screen="run"; S.log=[]; startWord(); }
function reviewNext(){ S.qIdx++; if(S.qIdx>=S.queue.length){ finishReview(); return; } startWord(); }
function finishReview(){ wordbreakCoreSession=null; S.mode="module"; S.queue=[]; S.qIdx=0; S.screen="debrief"; render(); }
/* ===================== SESSION RUNNER (plan 003) ===================== */
/* one continuous flow over the compiled block queue. rev blocks reuse the single-word review
   machinery; mod blocks reuse docs→run. The cursor (P.session.idx) advances ATOMICALLY inside
   logWord (decision 11), so a reload from any done screen resumes at the next block, never
   replaying a completed one. enterBlock is the sole authority on stale-skip + completion. */
function startSessionLegacy(bonus){
  const reuse = !bonus&&sessionValid(P.session);            /* resume an in-progress session vs compile a new one */
  if(!reuse&&P.session&&P.session.status==="in_progress")recordSessionEnd("abandoned");
  P.session = reuse ? P.session : compileSession(P.cfg.budgetMin,bonus?{bonus:true}:undefined);
  if(!P.session.blocks.length){ P.session=null; saveP(); goHome(); return; }  /* nothing to do — stay home */
  if(!reuse) recordSessionStart();                          /* only a NEW session gets a history row (resume keeps its own) */
  saveP(); enterBlock();
}
function startSession(bonus){
  wordbreakCoreSession=createCoreSession();
  const committed=commitCoreAction({type:"session.begin",budgetMin:P.cfg.budgetMin,bonus:!!bonus});
  wordbreakCoreSession=null;
  return committed;
}
function enterBlock(){
  const s=P.session; s.idx=nextLiveIdx(s);                  /* skip stale blocks (resume across a day/other play) */
  if(s.idx>=s.blocks.length){ s.done=true; recordSessionEnd(); saveP(); S.screen="sessionDone"; render(); return; }
  saveP();
  const b=s.blocks[s.idx]; S.log=[];
  if(b.k==="rev"){
    const e=P.sched[b.key], u=UNITS.find(x=>x.id===e.unit), w=u.words.find(x=>x.a.toLowerCase()===e.word);
    S.session=true; S.docsReadOnly=false; S.mode="review"; S.queue=[{u,w,e}]; S.qIdx=0; S.unit=u; S.screen="run"; startWord();
  } else {
    if(!P.docs[b.id]) openDocs(b.id,{session:true}); else openRun(b.id,{session:true});
  }
}
function advanceSession(){ if(P.session&&P.session.done){ recordSessionEnd("completed"); saveP(); S.screen="sessionDone"; render(); } else enterBlock(); }
/* current-block sub-progress in CELL units, for the strip only (display; never moves the cursor) */
function blockProgress(){
  const s=P.session, b=s&&s.blocks[s.idx]; if(!b) return 0;
  if(b.k==="rev") return 0;                                 /* single cell, fills on advance */
  const pc=b.pc||0;                                         /* panel cells snapshotted at compile — never un-light */
  const panels = (S.screen==="run") ? pc                    /* in the run → every panel cell is behind us */
    : Math.min(S.docsIdx,pc);                               /* in the lesson → light panels as they're read */
  const words = (S.screen==="run"&&S.mode==="module") ? S.wordIdx : 0;
  return Math.min(panels+words,b.cells);
}
/* the strip reflects the block ON SCREEN, which lags the durable cursor by one on a completion
   done-screen (the cursor already advanced in logWord, decision 11). without this the strip would
   light the next block's panels before they're read and label the final done screen "N+1/N". */
function sessionView(){
  const s=P.session; let bi=s.idx, prog=blockProgress();
  if(S.screen==="run"&&S.phase==="done"){                    /* run done-screen only — S.phase is stale on a docs screen */
    const modDone=S.mode==="module"&&(S.wordIdx===S.unit.words.length-1||S.fastCleared);
    if(S.mode==="review"||modDone){ bi=Math.max(0,s.idx-1); prog=s.blocks[bi]?s.blocks[bi].cells:0; }  /* block just finished → show it full */
    else { const b=s.blocks[bi]; prog=Math.min(prog+1,b?b.cells:prog); }                                /* mid-module: count the word just done */
  }
  return {bi,prog};
}
function sessionStrip(){
  const s=P.session; if(!s) return "";
  const {bi,prog}=sessionView();
  let out="";
  s.blocks.forEach((b,i)=>{
    const p = i<bi ? b.cells : i>bi ? 0 : prog;
    for(let c=0;c<b.cells;c++) out+=`<span class="${c<p?"lit":""}">■</span>`;
    if(i<s.blocks.length-1) out+=`<span style="opacity:.22"> · </span>`;
  });
  const shown=Math.min(bi+1,s.blocks.length);
  return `<div class="progress">${out} &nbsp; SESSION // block ${shown}/${s.blocks.length}</div>
  <div class="navrow" style="margin:-2px 0 10px"><button class="ghost" onclick="goHome()">⏸ pause — resume later</button><div class="spacer"></div></div>`;
}
/* days until the earliest FUTURE return (UTC-day math, expressed as a relative count so no
   fragile local-weekday conversion). null when nothing is scheduled ahead. */
function nextDueInDays(){
  let min=Infinity; for(const k in P.sched){ const d=P.sched[k].due; if(d>today()&&d<min) min=d; }
  return min===Infinity ? null : min-today();
}
function renderSessionDone(){
  const s=P.session, done=s.blocks.length, rate=s.stats.words?Math.round(100*s.stats.clean/s.stats.words):0;
  /* honesty about the queue (decision 2): if the budget capped reviews, bytes are still due NOW —
     say so rather than naming a future return that skips over today's remaining backlog. */
  const leftNow=dueList().length, nd=nextDueInDays();
  const ret = leftNow ? `<b style="color:var(--amber)">${leftNow} ${leftNow===1?"byte":"bytes"}</b> still due — they lead the next day's session`
    : nd!==null ? `next bytes return in <b>${nd} ${nd===1?"day":"days"}</b>`
    : `nothing queued to return — the frontier is the work`;
  html(`${titlebar("session/done")}
  <div class="card"><div class="eyebrow"><span class="n">›</span> SESSION COMPLETE</div>
  <div class="term"><div class="ln ok">✓ session compiled and run — <b>${done} ${done===1?"block":"blocks"}</b> closed by your fingers.</div>
  <div class="ln ${rate>=50?"ok":"warn"}">first-pass build: <b>${rate}%</b> clean (${s.stats.clean}/${s.stats.words}).</div>
  <div class="ln dim">${ret}. that return is where spelling sticks — not this first pass.</div></div>
  <div class="navrow"><div class="spacer"></div><button class="primary" onclick="goHome()">close ▶</button></div></div>`);
}
/* P.sessions history-row lifecycle (Phase 4, decision 4 + Phase-4 spec). ONE row per session,
   appended at start (scalars only — never block arrays, so each saveP stays small). The active
   session is always the LAST row (single active session by construction). An abandoned session
   is a row whose endedAt stays null — honestly visible, which is the point: completion rate must
   read worst exactly when the habit is failing. */
const SESSIONS_CAP=30;
function recordSessionStart(){
  const s=P.session;
  P.sessions.push({id:s.id,day:s.day,startReportDay:s.startReportDay,status:"in_progress",revision:1,
    bonus:!!s.bonus,budgetMin:s.budgetMin,blocksTotal:s.blocks.length,doneBlocks:0,
    activeMs:0,startedAt:s.startedAt,endedAt:null});
  reportAdd(s.startReportDay,s.bonus?"bonusStarted":"sessionsStarted");
  if(P.sessions.length>SESSIONS_CAP) P.sessions=P.sessions.slice(-SESSIONS_CAP);
}
function recordSessionEnd(status){
  const s=P.session,r=s&&P.sessions.find(x=>x.id===s.id);if(!s||!r||r.status!=="in_progress")return;
  status=status||"completed";const now=Date.now();r.status=status;r.endedAt=now;r.revision=(r.revision||1)+1;
  s.status=status;s.endedAt=now;s.revision=(s.revision||1)+1;
  reportAdd(s.startReportDay||reportDay(s.startedAt),status==="completed"?(s.bonus?"bonusCompleted":"sessionsCompleted"):"sessionsAbandoned");
  if(status==="completed"&&!s.bonus)P.assessment.nonbonusCompletedTotal++;
}
function startWordLegacy(){
  if(condTimer){ clearTimeout(condTimer); condTimer=null; }
  if(S.mode==="review"&&S.queue[S.qIdx]) S.unit=S.queue[S.qIdx].u;   /* borrow the owning unit for this due word */
  S.runGen++; S.phase="type"; S.typed=""; S.flagIdx=null; S.aimGood=false; S.firstClean=false; S.walkAnyway=false;
  S.condQ=0; S.condPicks={}; S.lineupSpent={}; S.witnessFound=false; S.memPhase="study"; S.patchTries=0; S.reveal=false;
  S.tShown=Date.now(); S.latency=null; render(); }
function cw(){ return S.mode==="review" ? S.queue[S.qIdx].w : S.unit.words[S.wordIdx]; }
function promptBlock(w){
  const p=w.p;
  if(p.k==="build"||p.k==="tr") return `<div class="wordprompt">${fmtPrompt(p.s)}</div>`;
  return `<div class="cluetext">clue: <b>${esc(p.cl)}</b></div>
  <div class="inputrow" style="margin-top:6px">
    <button type="button" class="small" data-say="${esc(w.a)}">▶ say it</button>
    <button type="button" class="small" data-say="${esc(w.a)}" data-slow>▶ slow</button></div>`;
}
function renderRun(){
  const u=S.unit,w=cw(),rev=S.mode==="review";
  const head=S.session
    ?`${titlebar("session")}
  ${sessionStrip()}`
    :rev
    ?`${titlebar("review/resurface")}
  <div class="progress">${S.queue.map((x,j)=>`<span class="${j===S.qIdx?"lit":""}">■</span>`).join(" ")} &nbsp; REVIEW // resurfacing due bytes — ${S.qIdx+1}/${S.queue.length} &nbsp;<span style="color:var(--dim)">${esc(u.id)} · ${esc(w.err||"")}</span></div>`
    :`${titlebar(u.id+"/run")}
  <div class="progress">${u.words.map((x,j)=>`<span class="${j===S.wordIdx?"lit":""}">■</span>`).join(" ")} &nbsp; PRACTICE // ${esc(u.ti)} — target ${S.wordIdx+1}/${u.words.length}</div>`;
  let body="";
  if(S.phase==="type"){
    body=`<div class="card"><div class="eyebrow"><span class="n">›</span> WRITE THE BUILD</div>
    ${promptBlock(w)}
    <div class="inputrow"><input type="text" id="wtype" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(S.typed)}">
    <button class="primary" onclick="commitTyped()">commit →</button></div>
    <div class="flaghint">type it. then tell me which letter you're least sure about — <b>before</b> you find out if you're right.</div></div>`;
  }
  else if(S.phase==="flag"){
    const bytes=S.typed.split("").map((ch,j)=>`<button type="button" class="byte ${S.flagIdx===j?"flagged":""}" onclick="setFlag(${j})"><span class="ch">${esc(ch)}</span><span class="ix">${j}</span></button>`).join("");
    body=`<div class="card"><div class="eyebrow"><span class="n">›</span> TELL ME YOUR WEAK LETTER</div>
    <div class="cluetext">your word, split into letters. click (or ← →) the one you're guessing at — not one you know cold. tell me right, and you score even if the whole word turns out wrong.</div>
    <div class="bytes">${bytes}</div>
    <div class="navrow"><div class="spacer"></div><button class="primary" ${S.flagIdx===null?"disabled":""} onclick="execute()">execute ▶</button></div></div>`;
  }
  else if(S.phase==="fork"){ body=renderFork(); }
  else if(S.phase==="patch"){ body=renderPatch(); }
  else if(S.phase==="done"){ body=renderDone(); }
  html(head+body); wireSay();
  const inp=document.getElementById("wtype"); if(inp){ inp.focus(); inp.addEventListener("keydown",e=>{if(e.key==="Enter")commitTyped();}); }
  const pin=document.getElementById("ptype"); if(pin){ pin.focus(); pin.addEventListener("keydown",e=>{if(e.key==="Enter")commitPatch();}); }
}
function commitTypedLegacy(){
  const inp=document.getElementById("wtype"); if(!inp)return;
  const v=inp.value.trim(); if(!v)return;
  if(S.latency==null) S.latency=Date.now()-S.tShown;   /* TYPE→FLAG submit; there is no re-commit path */
  S.typed=v; S.phase="flag"; S.flagIdx=null; render();
}
function setFlagLegacy(j){ S.flagIdx=j; render(); }
function executeLegacy(){
  const w=cw();
  const clean=S.typed.toLowerCase()===w.a.toLowerCase();
  S.aimGood=isHot(w,S.typed,S.flagIdx);
  if(clean){ S.firstClean=true;
    /* outlaw/legacy words always open the file — honesty mandate (methodology + curriculum E11) */
    if(w.fork.k==="mem"){ S.phase="fork"; render(); return; }
    if(!S.aimGood){ S.phase="done"; logWord(true); render(); return; }
    /* clean + good aim on a rule word: still show the verdict as confirmation */
    S.phase="fork"; render(); return;
  }
  S.firstClean=false; S.phase="fork"; render();
}
/* ---------- FORKS ---------- */
function compactConfirm(){
  const w=cw(),f=w.fork,flagCh=S.typed[S.flagIdx]||"?";
  let body;
  if(f.k==="cond") body=`<div class="verdict ${f.vc==="warn"?"warn":"good"}">${f.vd}</div>`;
  else{ const it=f.items.find(x=>x.role==="witness")||f.items[0];
    const stress=renderStress(it.stress);
    body=`<div class="verdict v">${stress?`source that wakes it: ${stress} — `:""}${it.line}</div>`; }
  return `<div class="card"><div class="eyebrow"><span class="n">›</span> YOU CALLED IT</div>
  <div class="term"><div class="ln ok">compile: CLEAN — and you flagged ‹${esc(flagCh)}› [${S.flagIdx}], the shaky byte. right build, right aim.</div>
  <div class="ln dim">no interrogation needed. that's the reward for knowing it cold.</div></div>
  ${body}
  <div class="navrow"><button class="ghost small" onclick="S.walkAnyway=true;render()">walk the interrogation anyway →</button><div class="spacer"></div>
  <button class="primary" onclick="confirmDone()">next ▶</button></div></div>`;
}
function renderFork(){
  const w=cw(),f=w.fork;
  const flagCh=S.typed[S.flagIdx]||"?";
  /* clean build + right aim on a rule word → he obviously has it. offer the door,
     don't march him through the interrogation. (outlaws still open the file — honesty mandate.) */
  if(S.firstClean&&S.aimGood&&!S.walkAnyway&&(f.k==="cond"||f.k==="lineup")) return compactConfirm();
  const aimLine=S.aimGood
    ?`<div class="ln ok">✓ you told me right — ‹${esc(flagCh)}› [${S.flagIdx}] really was the shaky letter.</div>`
    :`<div class="ln dim">‹${esc(flagCh)}` +`› [${S.flagIdx}] was solid. your shaky letter was somewhere else.</div>`;
  const compile=S.firstClean
    ?`<div class="ln ok">compile: CLEAN</div>`:`<div class="ln bad">compile: FAULT — build rejected</div>`;
  if(f.k==="cond"){
    if(!S.aimGood&&!S.firstClean){
      return `<div class="card"><div class="eyebrow"><span class="n">›</span> COMPILER OUTPUT</div>
      <div class="term">${compile}${aimLine}</div>
      <div class="verdict flat">correct build: <b>${esc(w.a)}</b> — handed to you flat. no interrogation without aim.</div>
      <div class="navrow"><div class="spacer"></div><button class="primary" onclick="toPatch()">patch it →</button></div></div>`;
    }
    let inner=`<div class="term">${compile}${aimLine}</div>`;
    const qs=f.qs;
    if(S.condQ<qs.length){
      const q=qs[S.condQ];
      inner+=`<div class="briefbody"><p><span class="c">interrogation ${S.condQ+1}/${qs.length}:</span> ${esc(q.q)}</p></div><div>`+
        q.o.map((o,j)=>{
          let cls="choice"; const pk=S.condPicks[S.condQ];
          if(pk!==undefined&&j===pk) cls+=(j===q.c?" picked-right":" picked-wrong");
          return `<button class="${cls}" onclick="condPick(${j})">${esc(o)}</button>`;}).join("")+`</div>`;
      const pk=S.condPicks[S.condQ];
      if(pk!==undefined&&pk!==q.c) inner+=`<div class="term"><div class="ln bad">✗ ${esc(q.why||"run it again.")}</div></div>`;
    } else {
      inner+=`<div class="verdict ${f.vc==="warn"?"warn":"good"}">${f.vd}</div>`;
      inner+= S.firstClean
        ?`<div class="navrow"><div class="spacer"></div><button class="primary" onclick="confirmDone()">confirmed — next ▶</button></div>`
        :`<div class="navrow"><div class="spacer"></div><button class="primary" onclick="toPatch()">patch it →</button></div>`;
    }
    return `<div class="card"><div class="eyebrow"><span class="n">›</span> THE INTERROGATION</div>${inner}</div>`;
  }
  if(f.k==="lineup"){
    if(!S.aimGood&&!S.firstClean){
      return `<div class="card"><div class="eyebrow"><span class="n">›</span> COMPILER OUTPUT</div>
      <div class="term">${compile}${aimLine}</div>
      <div class="verdict flat">correct build: <b>${esc(w.a)}</b> — handed flat. the source stays closed without aim.</div>
      <div class="navrow"><div class="spacer"></div><button class="primary" onclick="toPatch()">patch it →</button></div></div>`;
    }
    let inner=`<div class="term">${compile}${aimLine}<div class="ln info">that byte is a schwa — dead on arrival. sound won't help. <b>pull the source:</b> which relative wakes it?</div></div>`;
    inner+=f.items.map((it,j)=>{
      const spent=S.lineupSpent[j];
      let cls="lineup"+(spent?(it.role==="witness"?" hit":" spent"):"");
      let after="";
      if(spent){
        if(it.role==="witness"){
          const stress=renderStress(it.stress);
          after=`<div class="term"><div class="ln wit">▮ SOURCE FOUND: ${stress} <button type="button" class="small" data-say="${esc(it.w)}" data-slow>▶</button></div><div class="ln">${it.line}</div></div>`;
        } else after=`<div class="term"><div class="ln ${it.role==="impostor"?"bad":"dim"}">${it.line}</div></div>`;
      }
      return `<button class="${cls}" ${S.witnessFound||spent?"disabled":""} onclick="pullSource(${j})">${esc(it.w)}<span class="tag">${spent?esc(it.role):"pull source"}</span></button>${after}`;
    }).join("");
    if(S.witnessFound) inner+=`<div class="navrow"><div class="spacer"></div>${S.firstClean?`<button class="primary" onclick="confirmDone()">confirmed — next ▶</button>`:`<button class="primary" onclick="toPatch()">patch it →</button>`}</div>`;
    return `<div class="card"><div class="eyebrow"><span class="n">›</span> PULL THE SOURCE</div>${inner}</div>`;
  }
  /* mem — outlaw / legacy file (curriculum E11 · methodology outlaw bucket) */
  const bytes=w.a.split("").map((ch,j)=>`<div class="byte static ${f.dark.includes(j)?"dark":""}"><span class="ch">${esc(ch)}</span><span class="ix">${j}</span></div>`).join("");
  if(S.memPhase==="study"){
    const next=S.firstClean
      ?`<button class="primary" onclick="confirmDone()">filed — next ▶</button>`
      :`<button class="primary" onclick="S.memPhase='cover';S.phase='patch';render()">cover it — I have it ▶</button>`;
    return `<div class="card"><div class="eyebrow"><span class="n">›</span> LEGACY FILE — READ ACCESS</div>
    <div class="term">${compile}${S.aimGood?`<div class="ln ok">✓ you told me right — that letter really is dead. and here's the honest truth: no source exists for this one.</div>`:aimLine}
    <div class="ln warn">${esc(f.note)}</div></div>
    <div class="bytes">${bytes}</div>
    <div class="cluetext">${S.firstClean?"the red cells are the dead bytes — no rule covers them. file the face, then move on.":"the red cells are the dead bytes. stare at the culprit's face. when you have it — cover and retype."}</div>
    <div class="navrow"><div class="spacer"></div>${next}</div></div>`;
  }
  return "";
}
function condPick(j){
  const gen=S.runGen, qIdx=S.condQ;
  const q=cw().fork.qs[qIdx]; S.condPicks[qIdx]=j;
  if(condTimer){ clearTimeout(condTimer); condTimer=null; }
  if(j===q.c){
    condTimer=setTimeout(()=>{
      condTimer=null;
      if(S.runGen!==gen||S.screen!=="run"||S.phase!=="fork") return;
      if(S.condQ!==qIdx||S.condPicks[qIdx]!==q.c) return;
      S.condQ++; render();
    },450);
  }
  render();
}
function pullSource(j){
  const it=cw().fork.items[j]; S.lineupSpent[j]=true;
  if(it.role==="witness") S.witnessFound=true;
  render();
}
function toPatchLegacy(){ S.phase="patch"; S.patchTries=0; render(); }
function confirmDoneLegacy(){ S.phase="done"; logWord(S.firstClean); render(); }
/* ---------- PATCH ---------- */
function renderPatch(){
  const w=cw(),f=w.fork;
  let src="";
  if(f.k==="lineup"&&S.witnessFound){
    const it=f.items.find(x=>x.role==="witness");
    const stress=renderStress(it.stress);
    src=`<div class="term"><div class="ln wit">source stays open: ${stress}</div></div>`;
  }
  /* #3: withhold the exact letters — the rule held under questioning, now he applies it
     from memory instead of copying the verdict he just read. the 3-miss reveal is the safety net. */
  /* patch is only ever reached with S.firstClean===false (every path here gates on a
     faulted build first) — S.aimGood is the only live condition */
  if(f.k==="cond"&&S.aimGood) src=`<div class="verdict flat" style="font-size:13px">the rule checked out under questioning. now build it from memory — the letters stay covered.</div>`;
  if(f.k==="mem") src=`<div class="cluetext">file covered. write it from memory — dead bytes and all.</div>`;
  const revealBlock=S.reveal?`<div class="term"><div class="ln warn">answer, one look: <b>${esc(w.a)}</b> — now it goes away. type it.</div></div>`:"";
  return `<div class="card"><div class="eyebrow"><span class="n">›</span> PATCH — WRITE THE FINAL BUILD</div>
  ${src}${revealBlock}
  <div class="inputrow"><input type="text" id="ptype" autocomplete="off" autocapitalize="off" spellcheck="false">
  <button class="primary" onclick="commitPatch()">compile ▶</button></div>
  <div id="pmsg">${S.patchTries&&!S.reveal?`<div class="term"><div class="ln bad">✗ still faulted — check the ${w.fork.k==="lineup"?"source":w.fork.k==="mem"?"dead bytes":"verdict"} and go again.</div></div>`:""}</div>
  ${f.k==="mem"?`<div class="navrow"><button class="ghost small" onclick="S.phase='fork';S.memPhase='study';render()">← re-open the file</button></div>`:""}</div>`;
}
function commitPatchLegacy(){
  const w=cw(); const inp=document.getElementById("ptype"); if(!inp)return;
  const v=inp.value.trim().toLowerCase();
  if(v===w.a.toLowerCase()){ S.phase="done"; logWord(false); render(); return; }
  S.patchTries++;
  const msg=document.getElementById("pmsg");
  if(S.patchTries>=3&&!S.reveal){ S.reveal=true; render(); return; }
  msg.innerHTML=`<div class="term"><div class="ln bad">✗ still faulted — check the ${w.fork.k==="lineup"?"source":w.fork.k==="mem"?"dead bytes":"verdict"} and go again.</div></div>`;
  inp.select();
}

function createCoreSession(){
  return WordbreakCore.create({
    stateJson:JSON.stringify(P),content:{UNITS,ASSESSMENT_FORMS},nowMs:Date.now(),
    timezoneOffsetMinutes:new Date().getTimezoneOffset(),random:()=>{const byte=new Uint8Array(1);crypto.getRandomValues(byte);return byte[0]/256;},
    uuid:()=>crypto.randomUUID()
  });
}
function commitCoreAction(action){
  const output=wordbreakCoreSession.dispatch(action);
  try{ localStorage.setItem("wb2",output.stateJson); }
  catch(error){
    wordbreakCoreSession.discard();
    setTimeout(()=>alert("Wordbreak could not safely save this step. Free browser storage, then retry before continuing."),0);
    return false;
  }
  wordbreakCoreSession.accept(output.stateJson);
  const nextState=JSON.parse(output.stateJson),nextScreen=output.viewModel;
  for(const key of Object.keys(P))delete P[key];Object.assign(P,nextState);
  for(const key of Object.keys(S))delete S[key];Object.assign(S,nextScreen);
  reportSaveFailed=false;scheduleReportSync();render();
  return true;
}
function openRun(id,opts){
  opts=opts||{};
  if(opts.session){wordbreakCoreSession=null;return openRunLegacy(id,opts);}
  const unit=UNITS.find(candidate=>candidate.id===id);
  if(!isEnabledUnit(unit)||!P.docs[id])return goHome();
  wordbreakCoreSession=createCoreSession();
  commitCoreAction({type:"unit.openRun",unitId:id,session:false});
}
function startWord(){
  if(!wordbreakCoreSession)return startWordLegacy();
  commitCoreAction({type:"word.start",wordIndex:S.wordIdx});
}
function commitTyped(){
  if(!wordbreakCoreSession)return commitTypedLegacy();
  const input=document.getElementById("wtype");if(!input)return;
  commitCoreAction({type:"word.commitTyped",value:input.value});
}
function setFlag(index){
  if(!wordbreakCoreSession)return setFlagLegacy(index);
  commitCoreAction({type:"word.setFlag",index});
}
function execute(){
  if(!wordbreakCoreSession)return executeLegacy();
  commitCoreAction({type:"word.execute"});
}
function toPatch(){
  if(!wordbreakCoreSession)return toPatchLegacy();
  commitCoreAction({type:"word.toPatch"});
}
function confirmDone(){
  if(!wordbreakCoreSession)return confirmDoneLegacy();
  commitCoreAction({type:"word.confirmDone"});
}
function commitPatch(){
  if(!wordbreakCoreSession)return commitPatchLegacy();
  const input=document.getElementById("ptype");if(!input)return;
  commitCoreAction({type:"word.commitPatch",value:input.value});
}
/* ---------- DONE / LOG ---------- */
function logWord(cleanPath){
  const w=cw();
  const solve = w.fork.k==="mem" ? (cleanPath?"—":"booked")
    : cleanPath&&!S.aimGood ? "—"
    : (S.aimGood?"earned":"handed");
  /* w.err is always set by resolveErrCodes() at boot — no fallback needed */
  S.log.push({module:S.unit.nm,word:w.a,clean:S.firstClean,aim:S.aimGood,solve:solve,err:w.err});
  const ev={t:Date.now(),unit:S.unit.id,word:w.a,clean:S.firstClean,aim:S.aimGood,solve:solve,err:w.err,
    latency:S.latency,tries:S.patchTries,revealed:S.reveal};
  P.log.push(ev);
  const day=reportTouch(reportDay(ev.t));
  day.practiceEvents++;if(S.firstClean)day.clean++;if(S.aimGood)day.liveAim++;
  if(S.mode==="review"){day.reviewEvents++;if(S.firstClean)day.reviewClean++;if(S.aimGood)day.reviewLiveAim++;}
  if(w.err&&w.err!=="E0"){
    const c=day.codes[w.err]||(day.codes[w.err]={seen:0,clean:0,aim:0});
    c.seen++;if(S.firstClean)c.clean++;if(S.aimGood)c.aim++;
  }
  if(P.log.length>LOG_CAP) P.log=P.log.slice(-LOG_CAP);
  scheduleWord(w,S.firstClean);                         /* set its next return — the widening interval */
  onEncounter(ev);                                      /* feed the measured profile (skips E0 internally) */
  let lastWord=false, fastClear=false;
  if(S.mode!=="review"){
    lastWord=S.wordIdx===S.unit.words.length-1;
    fastClear=S.fastPass&&cleanPath&&S.wordIdx===0;     /* one CLEAN FIRST build clears it; a word-0 fault falls
                                                            back to the full word set (mastery wasn't demonstrated) */
    if(lastWord||fastClear){
      const newlyCleared=!P.cleared[S.unit.id];P.cleared[S.unit.id]=true;
      if(newlyCleared&&!day.modulesCleared.includes(S.unit.id))day.modulesCleared.push(S.unit.id);
      if(fastClear&&!lastWord) S.fastCleared=true;
    }
  }
  /* atomic session advance (decision 11): the cursor moves in the SAME saveP as the ledger
     writes above, so a reload from the done screen resumes at the next block — never replaying
     this word. a rev block is one word (always done here); a mod block is done when it clears. */
  if(S.session&&P.session){
    P.session.stats.words++; if(S.firstClean) P.session.stats.clean++;
    const blockDone = S.mode==="review" ? true : (lastWord||fastClear);
    if(blockDone){
      P.session.idx++;
      recordBlockDone();                                /* Phase 4 history row (no-op until then) */
      if(P.session.idx>=P.session.blocks.length){ P.session.done=true; recordSessionEnd("completed"); }
    }
  }
  saveP();
}
function recordBlockDone(){ const r=P.sessions[P.sessions.length-1]; if(r) r.doneBlocks++; }   /* mutate the active (last) row */
function renderDone(){
  const w=cw(),rev=S.mode==="review";
  const last=rev?(S.qIdx===S.queue.length-1):(S.wordIdx===S.unit.words.length-1);
  const moduleDone=last||S.fastCleared;                 /* fast-pass: one clean build ends the module early */
  const aimNote=S.aimGood?`<div class="ln ok">aim: live byte — you told me the right letter.</div>`
    :`<div class="ln dim">aim: cold cell. next run, ask first: <i>which letter would I tell you is wrong?</i></div>`;
  /* session mode: the cursor already advanced in logWord (decision 11), so the CTA is pure
     navigation. within a mod block with words left, stay in the module; otherwise advance. */
  const modMore = S.mode==="module" && !moduleDone;    /* more words remain in this module block */
  const nextBtn = S.session
    ?(modMore?`<button class="primary" onclick="S.wordIdx++;startWord()">next byte ▶</button>`
      :P.session&&P.session.done?`<button class="primary" onclick="advanceSession()">session complete ▶</button>`
      :`<button class="primary" onclick="advanceSession()">next ▶</button>`)
    :rev
    ?(last?`<button class="primary" onclick="finishReview()">review complete — close ▶</button>`
      :`<button class="primary" onclick="reviewNext()">next due byte ▶</button>`)
    :(moduleDone?`<button class="primary" onclick="closeModule()">${S.fastCleared&&!last?"pattern locked in — cleared ▶":"module cleared — close ▶"}</button>`
      :`<button class="primary" onclick="S.wordIdx++;startWord()">next target ▶</button>`);
  return `<div class="card"><div class="eyebrow"><span class="n">›</span> COMPILE: CLEAN</div>
  <div class="term"><div class="ln ok">✓ <b>${esc(w.a)}</b> — committed by your fingers.</div>
  ${S.firstClean?`<div class="ln ok">first-pass build: clean.</div>`:`<div class="ln warn">first-pass build: faulted → patched. the patch is the lesson.</div>`}
  ${aimNote}</div>
  <div class="navrow"><div class="spacer"></div>${nextBtn}</div></div>`;
}
function closeModule(){ wordbreakCoreSession=null; S.screen="debrief"; render(); }
/* ===================== BEFORE / AFTER SPELLING PROBE ===================== */
const ASSESSMENT_WAIT_DAYS=28, ASSESSMENT_WAIT_SESSIONS=12;
function assessmentId(){
  if(crypto.randomUUID)return crypto.randomUUID();
  const b=new Uint8Array(16);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
}
function assessmentShuffle(ids,seed){
  let x=parseInt(fnv1a32(seed),16)>>>0,a=ids.slice();
  for(let i=a.length-1;i>0;i--){x=(Math.imul(x,1664525)+1013904223)>>>0;const j=x%(i+1);[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function assessmentRuns(role,status){return P.assessment.runs.filter(r=>(!role||r.role===role)&&(!status||r.status===status));}
function assessmentActive(){return P.assessment.runs.find(r=>r.status==="in_progress")||null;}
function assessmentComplete(role){return assessmentRuns(role,"completed").slice(-1)[0]||null;}
function assessmentPhase(){
  const active=assessmentActive();if(active)return active.role+"_in_progress";
  if(assessmentComplete("followup"))return "complete";
  if(assessmentComplete("baseline"))return "baseline_complete";
  return "unstarted";
}
function assessmentCalendarDays(a,b){const x=new Date(a),y=new Date(b);return Math.floor((Date.UTC(y.getFullYear(),y.getMonth(),y.getDate())-Date.UTC(x.getFullYear(),x.getMonth(),x.getDate()))/86400000);}
function assessmentEligibility(){
  const b=assessmentComplete("baseline");if(!b)return {eligible:false,days:0,sessions:0};
  const days=assessmentCalendarDays(b.completedAt,Date.now()),sessions=Math.max(0,P.assessment.nonbonusCompletedTotal-b.completedNonbonusTotal);
  return {eligible:days>=ASSESSMENT_WAIT_DAYS&&sessions>=ASSESSMENT_WAIT_SESSIONS,days,sessions};
}
function assessmentItemFor(run){const id=run.order[run.cursor];return ASSESSMENT_FORMS[run.form].find(x=>x.id===id)||null;}
function assessmentNormalize(value){return String(value).normalize("NFC").trim().toLowerCase();}
function assessmentScore(run){
  const form=ASSESSMENT_FORMS[run.form],byId=Object.fromEntries(form.map(x=>[x.id,x])),groups={};let correct=0;
  for(const answer of run.responses){const item=byId[answer.itemId];if(!item)continue;const hit=assessmentNormalize(answer.response)===item.target;
    if(hit)correct++;const g=groups[item.primaryCode]||(groups[item.primaryCode]={correct:0,attempted:0});g.attempted++;if(hit)g.correct++;}
  return {correct,total:form.length,groups};
}
function assessmentDevice(){return {userAgent:navigator.userAgent,platform:navigator.platform||"unknown"};}
function startAssessmentLegacy(role,override){
  if(!ASSESSMENT_ON||assessmentActive())return;
  const baseline=assessmentComplete("baseline");
  if(role==="followup"){
    if(!baseline||assessmentComplete("followup"))return;
    const e=assessmentEligibility();
    if(!e.eligible&&!override)return;
  }
  if(role==="followup"&&!assessmentEligibility().eligible&&!confirm("This follow-up is earlier than the 28-day and 12-session gate. Continue and permanently label the comparison noncomparable?"))return;
  if(!confirm("Run this spelling calibration in one quiet sitting, on this device with headphones, without hints, spellcheck, or outside help?"))return;
  const overrideReason=role==="followup"&&!assessmentEligibility().eligible?"observer timing override":null;
  const before=structuredClone(P.assessment),id=assessmentId();
  if(!P.assessment.assignment){const b=new Uint8Array(1);crypto.getRandomValues(b);P.assessment.assignment=b[0]%2?"A":"B";}
  const form=role==="baseline"?P.assessment.assignment:(P.assessment.assignment==="A"?"B":"A");
  const priorRestart=assessmentRuns(role).some(r=>r.status==="abandoned_noncomparable");
  const reasons=[];if(priorRestart)reasons.push(role+" was restarted");if(overrideReason)reasons.push("timing override: "+overrideReason.trim());
  P.assessment.runs.push({id,role,form,status:"in_progress",order:assessmentShuffle(ASSESSMENT_FORMS[form].map(x=>x.id),id),cursor:0,
    responses:[],replays:{},startedAt:Date.now(),completedAt:null,completedNonbonusTotal:null,interruptions:0,
    comparable:!reasons.length,reasons,device:assessmentDevice(),staticAudioFailed:false});
  if(!saveP()){P.assessment=before;return;}
  S.screen="assessment";S.assessmentPagehideRecorded=false;render();
}
function startAssessment(role,override){
  if(role!=="baseline")return startAssessmentLegacy(role,override);
  if(!ASSESSMENT_ON||assessmentActive())return;
  if(!confirm("Run this spelling calibration in one quiet sitting, on this device with headphones, without hints, spellcheck, or outside help?"))return;
  wordbreakCoreSession=createCoreSession();
  commitCoreAction({type:"assessment.start",role:"baseline",device:assessmentDevice()});
}
function resumeAssessment(){if(!assessmentActive())return;S.screen="assessment";S.assessmentPagehideRecorded=false;render();}
function abandonAssessment(){
  const run=assessmentActive();if(!run||!confirm("Stop this calibration? The attempt will be retained and any restart will make the comparison noncomparable."))return;
  const before=structuredClone(P.assessment);run.status="abandoned_noncomparable";run.completedAt=Date.now();run.comparable=false;run.reasons.push("run was restarted");
  if(!saveP()){P.assessment=before;return;}goHome();
}
async function playAssessmentAudio(){
  const run=assessmentActive(),item=run&&assessmentItemFor(run);if(!run||!item||S.assessmentAudioBusy)return;
  const plays=run.replays[item.id]||0;if(plays>=2)return;S.assessmentAudioBusy=true;
  const key=fnv1a32([AUDIO_GEN,AUDIO_VOICE,"n",normalize(item.audioText)].join("|")),url=AUDIO_BASE+key+".mp3";
  try{
    curAudio?.pause();speechSynthesis.cancel();let src=url,objectUrl=null;
    if(typeof caches!=="undefined"){const cached=await caches.match(url);if(cached){objectUrl=URL.createObjectURL(await cached.blob());src=objectUrl;}}
    const audio=new Audio(src);curAudio=audio;
    await new Promise((resolve,reject)=>{audio.addEventListener("playing",resolve,{once:true});audio.addEventListener("error",()=>reject(new Error("audio")),{once:true});audio.play().catch(reject);});
    const before=structuredClone(P.assessment);run.replays[item.id]=plays+1;if(!saveP())P.assessment=before;
    if(objectUrl)audio.addEventListener("ended",()=>URL.revokeObjectURL(objectUrl),{once:true});render();
  }catch(e){run.staticAudioFailed=true;run.comparable=false;if(!run.reasons.includes("static audio failed"))run.reasons.push("static audio failed");saveP();render();}
  finally{S.assessmentAudioBusy=false;}
}
function submitAssessmentResponse(itemId,response){
  const run=assessmentActive();if(!run)return false;
  const normalized=assessmentNormalize(response),item=assessmentItemFor(run);
  const last=run.responses[run.responses.length-1];
  if(last&&last.itemId===itemId&&assessmentNormalize(last.response)===normalized)return true;
  if(!item||item.id!==itemId||!normalized){run.status="corrupt_noncomparable";run.comparable=false;run.reasons.push("invalid response transition");saveP();render();return false;}
  if(!(run.replays[item.id]>0)){alert("Play the word before submitting.");return false;}
  const before=structuredClone(P.assessment);run.responses.push({itemId,response:normalized});run.cursor++;
  if(run.cursor===run.order.length){run.status="completed";run.completedAt=Date.now();run.completedNonbonusTotal=P.assessment.nonbonusCompletedTotal;}
  if(!saveP()){P.assessment=before;return false;}
  if(run.status==="completed")S.screen="assessmentDone";render();return true;
}
function renderAssessment(){
  const run=assessmentActive();if(!run){goHome();return;}const item=assessmentItemFor(run);
  if(!item){run.status="corrupt_noncomparable";run.comparable=false;run.reasons.push("missing frozen item");saveP();goHome();return;}
  const plays=run.replays[item.id]||0,failed=run.staticAudioFailed;
  html(`${titlebar("calibration")}
  <div class="card" style="max-width:680px;margin:22px auto"><div class="eyebrow"><span class="n">›</span> SPELLING CALIBRATION · ${run.cursor+1}/${run.order.length}</div>
  <div class="brieftitle">listen. then type the word.</div><div class="cluetext">${esc(item.sentenceBefore)}<b>______</b>${esc(item.sentenceAfter)}</div>
  ${failed?`<div class="term"><div class="ln warn">The exact recording could not play. Pause here and retry on a stable connection; browser speech is not substituted.</div></div>`:""}
  <div class="navrow"><button class="primary" onclick="playAssessmentAudio()" ${plays>=2?"disabled":""}>${plays?"▶ replay once":"▶ play word"}</button><span class="cluetext">${plays}/2 plays used</span></div>
  <form id="assessment-form" style="margin-top:14px"><input id="assessment-answer" class="wordinput" aria-label="Spell the spoken word" spellcheck="false" autocorrect="off" autocomplete="off" autocapitalize="none" ${plays?"":"disabled"}>
  <div class="navrow"><button type="button" class="ghost" onclick="abandonAssessment()">stop</button><div class="spacer"></div><button class="primary" ${plays?"":"disabled"}>submit ▶</button></div></form></div>`);
  const input=document.getElementById("assessment-answer");input?.addEventListener("paste",e=>e.preventDefault());input?.addEventListener("drop",e=>e.preventDefault());
  document.getElementById("assessment-form")?.addEventListener("submit",e=>{e.preventDefault();submitAssessmentResponse(item.id,input.value);});if(plays)input?.focus();
}
function renderAssessmentDone(){
  html(`${titlebar("calibration/done")}<div class="card" style="max-width:680px;margin:22px auto"><div class="eyebrow"><span class="n">›</span> CALIBRATION COMPLETE</div>
  <div class="brieftitle">done. hand the device back.</div><div class="cluetext">No answers or score appear here. The observer can review the frozen result privately.</div>
  <div class="navrow"><div class="spacer"></div><button class="primary" onclick="goHome()">close ▶</button></div></div>`);
}
function assessmentConditions(run){const xs=[];if(run.interruptions)xs.push(`${run.interruptions} interruption${run.interruptions===1?"":"s"}`);if(Object.values(run.replays||{}).some(n=>n>1))xs.push("one or more replays");return xs.length?xs.join(" · "):"no recorded interruptions; no replays";}
function assessmentResult(run){
  const score=assessmentScore(run),form=ASSESSMENT_FORMS[run.form],byId=Object.fromEntries(form.map(x=>[x.id,x]));
  const rows=Object.keys(score.groups).sort((a,b)=>Number(a.slice(1))-Number(b.slice(1))).map(code=>{const g=score.groups[code];return `<tr><td>items selected as ${code} tripwires</td><td>${g.correct}/${g.attempted}</td></tr>`;}).join("");
  const answers=run.responses.map(x=>{const item=byId[x.itemId],hit=item&&assessmentNormalize(x.response)===item.target;return `<tr><td>${esc(x.itemId)}</td><td>${esc(item?.target||"missing")}</td><td>${esc(x.response)}</td><td class="${hit?"good":"bad"}">${hit?"exact":"not exact"}</td></tr>`;}).join("");
  return `<div class="cluetext"><b>Form ${run.form}: ${score.correct}/${score.total}</b> exact spellings · ${assessmentConditions(run)}</div><table class="debrief"><tr><th>selected tripwire</th><th>exact</th></tr>${rows}</table><details><summary class="cluetext">private item responses</summary><table class="debrief"><tr><th>item</th><th>target</th><th>response</th><th>result</th></tr>${answers}</table></details>`;
}
function assessmentObsCard(){
  if(!ASSESSMENT_ON)return "";const phase=assessmentPhase(),active=assessmentActive(),baseline=assessmentComplete("baseline"),followup=assessmentComplete("followup"),e=assessmentEligibility();let controls="",body="";
  if(active){body=`${active.role} · Form ${active.form} · ${active.cursor}/${active.order.length} responses saved.`;controls=`<button class="primary" onclick="resumeAssessment()">resume calibration ▶</button>`;}
  else if(!baseline){body="No baseline yet. Run it before adding the next curriculum layer.";controls=`<button class="primary" onclick="startAssessment('baseline')">start baseline ▶</button>`;}
  else if(!followup){body=`Follow-up gate: ${e.days}/28 calendar days · ${e.sessions}/12 completed sessions.`;controls=e.eligible?`<button class="primary" onclick="startAssessment('followup')">start follow-up ▶</button>`:`<button class="ghost small" onclick="startAssessment('followup',true)">override gate</button>`;}
  else body="The baseline/follow-up pair is complete. V1 does not repeat exposed forms.";
  let results=baseline?assessmentResult(baseline):"";
  if(followup){const a=assessmentScore(baseline),b=assessmentScore(followup),same=baseline.comparable&&followup.comparable&&baseline.device?.userAgent===followup.device?.userAgent;
    const codes=Array.from(new Set([...Object.keys(a.groups),...Object.keys(b.groups)])).sort((x,y)=>Number(x.slice(1))-Number(y.slice(1)));
    const deltas=codes.map(code=>`<tr><td>${code}</td><td>${a.groups[code]?.correct||0}/${a.groups[code]?.attempted||0}</td><td>${b.groups[code]?.correct||0}/${b.groups[code]?.attempted||0}</td></tr>`).join("");
    results+=assessmentResult(followup)+`<div class="term"><div class="ln ${same?"ok":"warn"}">${same?"descriptive comparison":"NONCOMPARABLE"}: Form ${followup.form} minus Form ${baseline.form} = <b>${b.correct-a.correct>=0?"+":""}${b.correct-a.correct}</b>. Unknown form difficulty is part of this difference; it is not a learning-effect claim.</div></div><table class="debrief"><tr><th>tripwire</th><th>Form ${baseline.form}</th><th>Form ${followup.form}</th></tr>${deltas}</table>`;}
  return `<div class="card"><div class="eyebrow"><span class="n">›</span> BEFORE / AFTER SPELLING CALIBRATION (observer)</div><div class="cluetext">${body}</div>${results}<div class="navrow">${controls}<div class="spacer"></div></div>
  <details style="margin-top:10px"><summary class="cluetext">reset assessment</summary><div class="inputrow"><input type="text" id="assessment-reset-confirm" autocomplete="off" spellcheck="false" placeholder="type RESET"><button class="ghost small" onclick="resetAssessment()">erase assessment responses</button></div></details></div>`;
}
function resetAssessment(){const input=document.getElementById("assessment-reset-confirm");if(input?.value!=="RESET"){alert("Type RESET exactly to erase assessment responses.");return;}const completed=P.assessment.nonbonusCompletedTotal;P.assessment=freshAssessment(completed);saveP();render();}
/* ---------- DEBRIEF ---------- */
/* observer-only: set the session time budget. tamper-visible, not gated (decision 8) — in a
   localStorage app any lock is theater; every P.sessions row records its budgetMin, so a dial
   turned down shows up as shrunken sessions in the history below. */
function setBudget(n){ P.cfg.budgetMin=n; saveP(); render(); }
/* the alarm instrument (decision 7 + Phase 4): sessions started per week and completion rate over
   NON-BONUS rows — if starts slip, the budget is too expensive; turn it down before the habit dies.
   an abandoned session is a row with endedAt==null, so completion rate reads worst when it should. */
function sessionObsCard(){
  if(!SESSION_ON) return "";
  const rows=P.sessions, nonBonus=rows.filter(r=>!r.bonus);
  const weekAgo=Date.now()-7*DAY;
  const startedThisWeek=nonBonus.filter(r=>r.startedAt>=weekAgo).length;
  const completed=nonBonus.filter(r=>r.endedAt!=null).length;
  const rate=nonBonus.length?Math.round(100*completed/nonBonus.length):0;
  const backlog=dueList().length, b=P.cfg.budgetMin;
  const presets=[10,20,30,45].map(n=>`<button class="small ${n===b?"primary":""}" onclick="setBudget(${n})">${n}m</button>`).join(" ");
  const recent=rows.slice(-8).reverse().map(r=>{
    const done=r.endedAt!=null, dur=r.endedAt?Math.max(1,Math.round((r.endedAt-r.startedAt)/60000)):null;
    return `<tr><td class="dimc">${r.bonus?"bonus":"session"}</td>
      <td class="${done?"good":"mid"}">${done?"complete":"abandoned"}</td>
      <td class="dimc">${r.doneBlocks}/${r.blocksTotal} blocks</td>
      <td class="dimc">${r.budgetMin}m budget${dur!=null?` · ~${dur}m run`:""}</td></tr>`;}).join("");
  return `<div class="card"><div class="eyebrow"><span class="n">›</span> SESSIONS — THE HABIT (observer)</div>
  <div class="cluetext" style="margin-bottom:8px">session budget (never shown to him): ${presets}
    &nbsp;·&nbsp; the budget SHAPES what compiles; it is not a clock he sees.</div>
  <div class="cluetext"><b style="color:var(--amber)">${startedThisWeek}</b> started this week · <b>${rate}%</b> completed (of ${nonBonus.length}) · <b>${backlog}</b> ${backlog===1?"byte":"bytes"} due now.
    the number that matters is <b>starts</b> — if it falls, the budget is too expensive; turn it down.</div>
  ${recent?`<table class="debrief" style="margin-top:8px"><tr><th>kind</th><th>outcome</th><th>done</th><th>budget · run</th></tr>${recent}</table>`:`<div class="cluetext" style="margin-top:6px">no sessions yet.</div>`}</div>`;
}
function openDebrief(){ S.session=false; S.docsReadOnly=false; S.screen="debrief"; S.log=[]; render(); }
function renderDebrief(){
  const rows=(S.log.length?S.log:P.log.slice(-20).map(e=>({module:e.unit,word:e.word,clean:e.clean,aim:e.aim,solve:e.solve,err:e.err})));
  const table=rows.length?`<table class="debrief"><tr><th>module</th><th>word</th><th>err</th><th>first build</th><th>aim</th><th>solve</th></tr>`+
    rows.map(r=>`<tr><td class="dimc">${esc(r.module)}</td><td><b>${esc(r.word)}</b></td>
    <td class="dimc">${esc(r.err||"—")}</td>
    <td class="${r.clean?"good":"bad"}">${r.clean?"clean":"faulted"}</td>
    <td class="${r.aim?"good":"dimc"}">${r.aim?"live byte":"cold"}</td>
    <td class="${r.solve==="earned"?"good":r.solve==="handed"?"mid":"dimc"}">${esc(r.solve)}</td></tr>`).join("")+`</table>`
    :`<div class="cluetext">no runs logged yet.</div>`;
  const prof=codeProfile().filter(p=>p.seen>0).sort((a,b)=>a.theta-b.theta);
  const barColor=b=>b==="solid"?"var(--green)":b==="weak"?"var(--red)":b==="frontier"?"var(--amber)":"var(--dim)";
  const profCard=prof.length?`<div class="card"><div class="eyebrow"><span class="n">›</span> MEASURED PROFILE — PER ERROR-CODE (observer)</div>
  <table class="debrief"><tr><th>code</th><th>θ estimate</th><th>evidence</th><th>band</th></tr>`+
  prof.map(p=>{const pct=Math.round(p.theta*100);const bc=p.band==="solid"?"good":p.band==="weak"?"bad":p.band==="frontier"?"mid":"dimc";
    return `<tr><td class="dimc">${esc(p.code)}</td>
    <td><span style="display:inline-block;width:88px;height:8px;background:#0b0e13;border:1px solid var(--line);border-radius:4px;vertical-align:middle;margin-right:8px"><span style="display:block;width:${pct}%;height:100%;background:${barColor(p.band)}"></span></span>${pct}%</td>
    <td class="dimc">${p.seen} seen</td><td class="${bc}">${esc(p.band)}</td></tr>`;}).join("")+`</table>
  <div class="cluetext" style="margin-top:8px">a decayed estimate per error-type — not a grade, never shown to the kid. thin evidence reads honestly as «measuring». this is what drives Continue and fast-pass.</div></div>`:"";
  const fieldPackCard=FIELD_PACK_ON?`<div class="card quiet obs"><div class="eyebrow"><span class="n">›</span> NEXT FIELD PACK — FIXED, NOT DIAGNOSED</div><div class="cluetext">four short modules follow the core: family anchors, restored quiet syllables, prefix arithmetic, and -ion family coats. They were fixed before this pack was exposed; Luca's private baseline did not choose them.</div></div>`:"";
  html(`${titlebar("debrief")}
  <div class="card"><div class="eyebrow"><span class="n">›</span> SESSION LOG ${S.log.length?"— this module":"— recent"}</div>${table}</div>
  ${sessionObsCard()}
  ${reportingObsCard()}
  ${assessmentObsCard()}
  ${profCard}
  ${fieldPackCard}
  <div class="card quiet obs"><div class="eyebrow"><span class="n">›</span> FOR THE OBSERVER — WATCH FOR THESE, SAY NOTHING</div>
  <ol>
    <li><b>does he pause before flagging, or tap instantly?</b> a pause means the wager is doing its job — real risk assessment. instant tapping means it's decoration; tell me.</li>
    <li><b>which fork lands harder — the rule verdicts or the source pulls?</b> watch his face at the stress reveal vs. the arithmetic. that tells us where to build.</li>
    <li><b>does the «handed flat» outcome bother him?</b> it should feel like a door closing. if he doesn't care, the aim reward is too weak.</li>
    <li><b>after a faulted build, does he re-run the questions himself on the patch?</b> that's the win condition — the checklist migrating into his head.</li>
    <li><b>does he press start unprompted — or does it take nagging?</b> the queue now lives INSIDE the session: one new module first, then a small review dose, so there is no due-card to clear anymore. the whole game reduces to one question: does he come back and press start on his own? the SESSIONS card above tracks starts-per-week — if that number falls, the session is too expensive and the budget should come down. that's the judge that matters.</li>
  </ol></div>
  <div class="navrow"><button class="ghost" onclick="goHome()">← back to the stage map</button></div>`);
}
/* ===================== PRIVATE AGGREGATE REPORTING ===================== */
function reportActivity(){ reportLastActivity=performance.now(); }
function reportCredit(start,end){
  let a=start;
  while(a<end){
    const day=reportDay(Date.now()-(performance.now()-a));
    let b=end;
    if(reportDay(Date.now()-(performance.now()-end))!==day){
      let lo=a,hi=end; while(hi-lo>1){const mid=(lo+hi)/2;if(reportDay(Date.now()-(performance.now()-mid))===day)lo=mid;else hi=mid;} b=hi;
    }
    const ms=Math.max(0,Math.round(b-a));
    if(ms){ reportAdd(day,"activeMs",ms); if(P.session){P.session.activeMs=(P.session.activeMs||0)+ms;const row=P.sessions.find(x=>x.id===P.session.id);if(row)row.activeMs=(row.activeMs||0)+ms;} }
    a=b;
  }
}
function reportSample(force){
  const now=performance.now(), delta=Math.min(5000,Math.max(0,now-reportLastSample));
  const active=typeof S!=="undefined"&&S.session&&(S.screen==="docs"||S.screen==="run")&&!document.hidden&&now-reportLastActivity<=30000;
  if(active&&delta) reportCredit(now-delta,now);
  reportLastSample=now;
  if((active||force)&&delta) saveP();
}
function reportState(){ return {revision:Math.max(1,P.reporting.sourceRevision),
  cleared:Object.keys(P.cleared).filter(k=>P.cleared[k]&&isEnabledUnit(UNITS.find(u=>u.id===k))).sort(),docsCount:Object.keys(P.docs).filter(k=>isEnabledUnit(UNITS.find(u=>u.id===k))).length,
  dueCount:dueList().length,profile:Object.fromEntries(codeProfile().map(x=>[x.code,{theta:x.theta,seen:x.seen,band:x.band}])),
  legacy:P.reporting.legacy||{},incompleteSince:P.reporting.gaps.length?Date.now():null}; }
function reportCheckpoint(){
  const days=Object.keys(P.reporting.days).sort(), today=reportDay();
  return {earliestCompleteDay:days[0]||today,completeThroughDay:days.filter(x=>x<today).slice(-1)[0]||days[0]||today,gaps:P.reporting.gaps};
}
function reportDirty(){ return Object.values(P.reporting.days).filter(d=>(P.reporting.acked[d.day]||0)<d.revision).sort((a,b)=>a.day.localeCompare(b.day)); }
function scheduleReportSync(delay=300){
  if(!reportCredential||reportSaveFailed||reportSyncing)return;
  clearTimeout(reportSyncTimer); reportSyncTimer=setTimeout(reportPump,delay);
}
async function reportPump(){
  if(!reportCredential||reportSyncing||reportSaveFailed||!navigator.onLine)return;
  const dirty=reportDirty().slice(0,14), drained=!dirty.length;
  const payload={schemaVersion:1,sourceRevision:Math.max(1,P.reporting.sourceRevision),days:dirty,
    outboxDepth:dirty.length,state:reportState()};
  if(drained)payload.checkpoint=reportCheckpoint();
  reportSyncing=true;let nextDelay=null;
  try{
    const ctl=new AbortController(), timer=setTimeout(()=>ctl.abort(),8000);
    const response=await fetch("/api/reporting/sync",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+reportCredential.token},body:JSON.stringify(payload),signal:ctl.signal,keepalive:false});
    clearTimeout(timer);
    if(response.status===401){ reportCredential=null;localStorage.removeItem(REPORT_KEY);return; }
    if([404,405,409].includes(response.status))return;
    if(response.status===429||response.status>=500)throw new Error("retry");
    const data=await response.json();
    (data.accepted||[]).forEach(x=>{P.reporting.acked[x.day]=Math.max(P.reporting.acked[x.day]||0,x.revision);});
    (data.rejected||[]).forEach(x=>{P.reporting.deadLetters.push({day:x.day,revision:x.revision,error:x.error});reportGap(x.day,"terminal_rejection");P.reporting.acked[x.day]=Math.max(P.reporting.acked[x.day]||0,x.revision||0);});
    saveP(); nextDelay=dirty.length?1100:86400000;
  }catch(e){ nextDelay=5000+Math.floor(Math.random()*2000); }
  finally{ reportSyncing=false;if(nextDelay!==null)scheduleReportSync(nextDelay); }
}
async function finishReportEnrollment(){
  const code=REPORT_ENROLL_CODE; REPORT_ENROLL_CODE=null;
  if(!code)return;
  const ok=confirm("Connect private parent reports? Only aggregate practice totals, estimated active time, session completion, and spelling-pattern codes leave this browser. Typed words and mistakes stay here.");
  if(!ok)return;
  try{
    const response=await fetch("/api/reporting/enroll",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code})});
    if(!response.ok)throw new Error("pairing failed");
    reportCredential=await response.json();
    localStorage.setItem(REPORT_KEY,JSON.stringify(reportCredential));
    if(!P.reporting.legacy){ const times=P.log.map(x=>x.t).filter(Number.isFinite);P.reporting.legacy={observedFrom:times.length?Math.min(...times):null,observedThrough:times.length?Math.max(...times):null,practiceEvents:P.log.length,sessions:P.sessions.length,unknown:["activeMs","reviewProvenance","moduleClearDates","coverage"]}; }
    saveP(); try{await navigator.clipboard?.writeText("");}catch(e){} scheduleReportSync();
    alert("Private weekly reporting is connected. Spelling text stays on this device.");
  }catch(e){ alert("Reporting could not be connected. Ask the observer for a fresh link."); }
}
function reportingObsCard(){
  const state=!reportCredential?"not connected":P.reporting.gaps.length?"connected · incomplete coverage":reportSaveFailed?"storage needs attention":"connected";
  return `<div class="card"><div class="eyebrow"><span class="n">›</span> PRIVATE WEEKLY REPORT (observer)</div><div class="cluetext">${esc(state)} · aggregate totals only; typed spellings stay here.</div><div class="navrow"><button class="ghost small" onclick="exportProgress()">export progress</button><button class="ghost small" onclick="importProgress()">import progress</button></div></div>`;
}
function exportProgress(){
  if(!confirm("Export private Wordbreak progress? The file includes word-level practice history and assessment responses and should be stored securely."))return;
  const blob=new Blob([JSON.stringify({format:"wordbreak-progress",version:1,exportedAt:Date.now(),wb2:P})],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="wordbreak-progress.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function importProgress(){
  const input=document.createElement("input");input.type="file";input.accept="application/json";input.onchange=async()=>{
    try{const x=JSON.parse(await input.files[0].text());if(x.format!=="wordbreak-progress"||x.version!==1||!x.wb2)throw new Error();const normalized=normalizeImportedProgress(x.wb2);if(!normalized.ok)throw new Error(normalized.error);if(!confirm("Replace this browser's Wordbreak progress? Reporting will disconnect so imported progress cannot use another learner's credential."))return;reportCredential=null;localStorage.removeItem(REPORT_KEY);localStorage.setItem("wb2",JSON.stringify(normalized.state));location.reload();}catch(e){alert("That is not a valid or compatible Wordbreak progress export.");}
  };input.click();
}
let reportWriter=true, reportLockRelease=null;
function claimReportWriter(){
  if(!reportCredential)return;
  if(navigator.locks){
    reportWriter=false;
    navigator.locks.request("wordbreak-reporting-writer",{ifAvailable:true},async lock=>{
      if(!lock){alert("Wordbreak is already open in another tab. Close the other tab before practicing here.");return;}
      reportWriter=true;await new Promise(resolve=>{reportLockRelease=resolve;});
    });
  }
}
function reportPagehide(){
  reportSample(true);
  const assessmentRun=assessmentActive();
  if(assessmentRun&&S.screen==="assessment"&&!S.assessmentPagehideRecorded){assessmentRun.interruptions=(assessmentRun.interruptions||0)+1;S.assessmentPagehideRecorded=true;saveP();}
  const dirty=reportDirty().slice(0,14);if(!reportCredential||!dirty.length)return;
  const payload={schemaVersion:1,sourceRevision:Math.max(1,P.reporting.sourceRevision),days:dirty,outboxDepth:dirty.length,state:reportState()};
  const raw=JSON.stringify(payload);if(new TextEncoder().encode(raw).length>48*1024)return;
  fetch("/api/reporting/sync",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+reportCredential.token},body:raw,keepalive:true}).catch(()=>{});
}
/* ---------- DISPATCH ---------- */
/* goHome clears the session-flow flags (decision 12) but LEAVES P.session intact — a paused or
   completed session must still be resumable/showable from home (decisions 4, 7). */
function goHome(){ wordbreakCoreSession=null; if(condTimer){ clearTimeout(condTimer); condTimer=null; } S.session=false; S.docsReadOnly=false; S.screen="home"; render(); }
function render(){
  if(S.screen==="home")renderHome();
  else if(S.screen==="docs")renderDocs();
  else if(S.screen==="run")renderRun();
  else if(S.screen==="sessionDone")renderSessionDone();
  else if(S.screen==="debrief")renderDebrief();
  else if(S.screen==="assessment")renderAssessment();
  else if(S.screen==="assessmentDone")renderAssessmentDone();
}
document.addEventListener("keydown",e=>{
  if(S.screen!=="run"||S.phase!=="flag") return;
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  const n=S.typed.length; if(!n) return;
  if(e.key==="ArrowRight"){ e.preventDefault(); setFlag(S.flagIdx===null?0:Math.min(n-1,S.flagIdx+1)); }
  else if(e.key==="ArrowLeft"){ e.preventDefault(); setFlag(S.flagIdx===null?0:Math.max(0,S.flagIdx-1)); }
  else if(e.key==="Enter"&&S.flagIdx!==null){ e.preventDefault(); execute(); }
  else if(e.key>="0"&&e.key<="9"){ const j=+e.key; if(j<n){ e.preventDefault(); setFlag(j); } }
});
window.togStage=togStage;window.openDocs=openDocs;window.openRun=openRun;window.ketsuPick=ketsuPick;
window.ketsuType=ketsuType;window.commitTyped=commitTyped;window.setFlag=setFlag;window.execute=execute;
window.condPick=condPick;window.pullSource=pullSource;window.toPatch=toPatch;window.commitPatch=commitPatch;
window.confirmDone=confirmDone;window.continueGo=continueGo;
window.closeModule=closeModule;window.openDebrief=openDebrief;window.goHome=goHome;
window.startReview=startReview;window.reviewNext=reviewNext;window.finishReview=finishReview;
window.startSession=startSession;window.advanceSession=advanceSession;window.setBudget=setBudget;
window.exportProgress=exportProgress;window.importProgress=importProgress;
window.startAssessment=startAssessment;window.resumeAssessment=resumeAssessment;window.abandonAssessment=abandonAssessment;
window.playAssessmentAudio=playAssessmentAudio;window.resetAssessment=resetAssessment;
resolveErrCodes();
render();
saveP();
claimReportWriter();
setInterval(()=>reportSample(false),5000);
setInterval(()=>{if(reportFillDays())saveP();},60000);
for(const event of ["pointerdown","keydown","touchstart"])document.addEventListener(event,reportActivity,{passive:true});
document.addEventListener("click",e=>{
  if((reportCredential&&!reportWriter)||reportSaveFailed){e.preventDefault();e.stopImmediatePropagation();alert(reportSaveFailed?"This step is paused until Wordbreak can save safely.":"Close the other Wordbreak tab before practicing here.");}
},true);
document.addEventListener("visibilitychange",()=>{reportSample(true);if(!document.hidden){if(reportFillDays())saveP();scheduleReportSync();}});
window.addEventListener("online",()=>scheduleReportSync());
window.addEventListener("pagehide",reportPagehide);
finishReportEnrollment();
setTimeout(precacheAudio,0);
