# Plan 001 — Pre-generated Kokoro audio bundled as static assets

## Goal

Replace Wordbreak's on-device browser TTS (`SpeechSynthesisUtterance`) with
pre-generated MP3 audio. Every spoken clip is rendered once by **Kokoro TTS
(voice `af_heart`)** via the local `github/botnet` service, committed into the
site's static assets under `public/audio/`, and played back **same-origin**
(`wordbreak.fun/audio/<key>.mp3`) — no R2, no subdomain, no CORS, no Worker.
Robotic, inconsistent, per-device browser voices go away; every kid hears the
same clean voice. The corpus is precached for guaranteed offline playback;
`speechSynthesis` stays only as a last-resort fallback.

## Context

- Product frame and the role of "say it / slow" and the witness "pull the
  source" audio: [README.md](../../README.md) §3 (the core loop), §4 (the three
  forks), and the Restore/Anchor moves in
  [methodology.md](../../methodology.md) (§ "Say the careful pronunciation").
- Audio surface today is tiny and centralized — one function and two render
  sites in [wordbreak_v2.html](../../wordbreak_v2.html):
  - `say(text, slow)` at **line 168** — the only TTS entry point. `slow`
    switches `utterance.rate` between `0.85` and `0.6`.
  - `wireSay()` at **line 172** binds every `[data-say]` element's click to
    `say(el.dataset.say, el.hasAttribute("data-slow"))`.
  - "▶ say it" / "▶ slow" buttons at **lines 863–864** use
    `data-say="${w.a}"` (the answer word). Rendered only for `p.k==="say"`
    prompt words (`promptBlock`, line 858).
  - The witness "▶" button at **line 961** uses `data-say="${it.sayAs}"`
    `data-slow` inside a `fork.k==="lineup"` item where `role==="witness"`.
- Data source of truth: `const UNITS=[]` at **line 197**, populated by
  `UNITS.push({...})`. Each unit has `words:[{a, p:{k,...}, fork:{...}}]`;
  lineup forks carry `items:[{w, role, sayAs, ...}]`. This is the array the
  generator must read to know every string to synthesize.
- Deploy shape: Wordbreak ships as **pure Cloudflare static assets** — no
  Worker `main`. [wrangler.jsonc](../../wrangler.jsonc) serves `./public` (SPA),
  routed to `wordbreak.fun`. **`public/` is committed** (favicons, `og.png`, and
  the generated `index.html` all live there and are tracked by git). Audio joins
  them as another committed asset dir — nothing about the deploy pipeline
  changes. `npm run deploy` = `sync:public` (copies the HTML to
  `public/index.html`) then `scripts/deploy.mjs` (`wrangler deploy`); the MP3s in
  `public/audio/` upload as part of the same asset push. Cloudflare Workers
  static-asset limits (20,000 files, 25 MiB each) dwarf a few hundred ~15 KB
  clips.
- Botnet is the generator. It already exposes Kokoro/Core ML TTS over HTTP:
  - `POST /v1/tts/synthesize` — body `{text, voice:"af_heart", speed, format:"mp3", waitMode}`; returns `202 queued` + `jobId` (or `200 completed` on bounded wait). Docs: `botnet/README/docs/api.md` (§ "POST /v1/tts/synthesize") and `botnet/README/docs/consumer-integration.md` (§ "Minimal TTS Queue Example").
  - `GET /v1/jobs/:jobId` — poll to `completed`.
  - `GET /v1/tts/results/:jobId/audio` — download the MP3 (`audio/mpeg`).
  - Reference driver to copy: `botnet/scripts/tts-prove-live.ts`
    (synthesize → poll → validate MP3 header).
  - Requires a running control plane **with at least one Kokoro worker online**
    (`botnet/README/docs/kokoro-worker-ops.md`) and a provisioned caller key
    (`pnpm provision:caller-key`, per consumer-integration.md).

### Constraints that survive a "why"

- **Single HTML file, no build step for the app.** The game stays one file with
  the curriculum inline. The generator reads `UNITS` out-of-band; it does not
  fork the data into a second source. (README §9.)
- **No multiple-choice / recognition drift.** Audio is a clue and a correction
  aid, never the answer surface. Behavior of the four beats is unchanged.
- **"Never flash the answer. Hand the move."** Audio playback must not become a
  way to skip typing. `say()` is fire-and-forget; nothing about scoring or
  flow changes.
- **Guaranteed offline audio.** README §9 promises "no network calls after
  load." This plan keeps that promise for audio by **precaching the whole
  corpus into the Cache API on first load** (a few MB), then serving every clip
  cache-first. After one online session the game plays full Kokoro audio with no
  network — no lazy per-clip fetch that would strand an offline kid on the poor
  browser voice. `speechSynthesis` remains only as a true last resort (a device
  that has never once been online, or a key/asset mismatch bug). This is done
  page-side via the Cache API — **no service worker file** — so the single-HTML
  property survives. Document the relaxed-but-honored invariant.

### Design decisions (settled)

1. **Feed Kokoro the real word, not the browser-TTS respelling — but keep the
   respelling as the *fallback* text.** The `sayAs` fields
   (`"deff·ih·NIH·shun"`) exist only to trick `speechSynthesis` into stressing
   the right syllable; middots and pseudo-phonetics would corrupt Kokoro's G2P.
   Kokoro pronounces the real word (`it.w` = `"definition"`) correctly with
   natural stress. **Default: synthesize from `it.w` for witnesses and `w.a`
   for answers.** BUT the browser-TTS *fallback path* must still speak the
   respelling, or offline users lose the stress cue that is the whole point of
   the witness. So the audio text and the fallback text are **separate**:
   `say(audioText, slow, fallbackText)` — witness button carries
   `data-say="${it.w}"` (Kokoro key) **and** `data-fallback="${it.sayAs}"`
   (speechSynthesis text). `sayAs`/`stress` also stay in the visible verdict.
2. **Bake slow into the render, not `playbackRate`.** Generate two clips per
   word: normal (`speed:1.0`) and slow (`speed:0.7`). Kokoro's native speed is
   cleaner than HTML `playbackRate`, and it keeps `say()` trivial. (Cheap: see
   volume estimate below.)
3. **Content-addressed filenames, no runtime manifest.** Key each clip by a
   small synchronous hash shared byte-for-byte between generator (Node) and
   client (inline JS). The hashed string includes the render identity so that
   re-rendering the *same* text produces a *new* filename — automatic cache
   busting, since Cloudflare/browsers may cache static assets indefinitely.
   Contract:

   ```
   speedTag = slow ? "s" : "n"                 // maps to speed 0.7 / 1.0
   normalize(t) = t.normalize("NFC").trim().replace(/\s+/g," ")   // case preserved
   material = [AUDIO_GEN, "af_heart", speedTag, normalize(text)].join("|")
   key = fnv1a32(material) as 8-char lowercase hex   // FNV-1a 32-bit, UTF-8 bytes
   file = key + ".mp3"                          // lives at public/audio/<file>
   ```

   `AUDIO_GEN` is a manually-bumped generation string (e.g. `"g1"`) — bump it to
   force new filenames when re-rendering existing words (a fixed clip, a voice
   change, a Kokoro upgrade). `fnv1a32` is specified once in
   `scripts/audio/key.mjs` and copied verbatim inline into the HTML; a
   checked-in test asserts identical output for known vectors in **both** Node
   and a browser context. The full `docs/audio/audio-manifest.json` (key → text /
   speed / voice / gen) is the human-readable worklist and debug map. The client
   never does a per-click manifest *lookup* — it computes the key from the text.
   It does fetch **one** tiny list of filenames once on load
   (`public/audio/manifest.json`, a flat `["<key>.mp3", …]`) to know what to
   precache (see decision 5); that list is emitted by the same generator, so it
   can't drift.
5. **Precache the corpus into the Cache API, serve cache-first.** On load, open
   a versioned cache (`wb-audio-${AUDIO_GEN}`), `cache.addAll()` every file from
   `audio/manifest.json`, call `navigator.storage.persist()` so it isn't evicted
   under pressure, and delete stale `wb-audio-*` caches from older gens. `say()`
   resolves a clip as: `caches.match(url)` → play from cache; else `new Audio(url)`
   (network, also repopulates); else `speechSynthesis`. This is what makes
   offline audio *guaranteed* rather than best-effort, with no service worker.
4. **Serve same-origin as bundled static assets** — `public/audio/<key>.mp3`,
   played via `new Audio("audio/" + key + ".mp3")` (relative URL). Chosen over
   an R2 bucket + `audio.wordbreak.fun` because Wordbreak has **no Worker** to
   bind R2, and an R2 custom domain would force a whole separate hostname (R2
   binds a hostname, not a path) plus its own public-access setup. Bundling
   needs **zero new infra, zero credentials, zero CORS**, deploys atomically
   with the app, and caches for offline. Cost: the MP3s live in git and
   redeploy with the HTML — fine at this size, and regeneration is rare.

## Phases

### Phase 1 — Extract the canonical audio worklist (Wordbreak repo)

Build the single source of truth for *what* to synthesize, derived from
`UNITS` so it can never drift from the curriculum.

- [x] Add `scripts/audio/extract-worklist.mjs` reading `wordbreak_v2.html`.
  **The naive `vm` approach fails** (confirmed empirically): `const UNITS` at
  line 197 is a *lexical* binding, so `context.UNITS` is `undefined` after
  `vm.runInContext`; and `render()` (line ~1103), `document.addEventListener`
  (~1090), and `window.*=` (~1099) all run inside the same eval, so a mid-eval
  throw kills any capture appended after. Two workable approaches, in order:
  - **Preferred:** isolate the inline `<script>` text, append
    `;globalThis.__UNITS = UNITS;` to it, and run it in a `vm` context whose DOM
    stubs are complete enough to eval to completion: `document.getElementById`
    → object with settable `innerHTML`, `addEventListener`, `focus`, `select`;
    `document.querySelectorAll` → `[]`; plus `window`, `localStorage`
    (`getItem`→null/`setItem`), and `speechSynthesis` (`cancel`/`speak`) stubs.
    Read `context.__UNITS`.
  - **Fallback:** a bounded parser that extracts the `UNITS.push({...})` object
    literals directly.
  - Either way, **assert expected counts** (units, words, witnesses) so a
    curriculum edit that breaks extraction fails loudly.
- [x] Walk `UNITS`: for every `word` collect `word.a`; for every
  `word.fork.items[]` with `role==="witness"` collect `item.w` (plus its
  `item.sayAs` recorded as fallback text, not synthesized). Normalize per the
  decision-3 `normalize()`. De-dupe by final key.
- [x] For each unique text emit **two** entries (normal, slow) with
  `key`/`file` from `scripts/audio/key.mjs` (the shared hash, decision 3).
  Assert **no key collisions**; fail loudly if any. Support an optional
  per-entry `textOverride` (escape hatch: if Kokoro mis-stresses a witness, the
  override text is what gets synthesized while the key still derives from the
  displayed word) — empty for now.
- [x] Write two files (both committed): the full worklist/debug map
  `docs/audio/audio-manifest.json`
  (`{ gen:"g1", voice:"af_heart", generatedFrom:"wordbreak_v2.html", clips:[{key,text,textOverride?,speed,speedTag,file}] }`),
  and the flat runtime precache list `public/audio/manifest.json`
  (`["<key>.mp3", …]`, one per clip) that the client fetches on load
  (decision 5). Both come from the same walk, so they can't diverge.

**Verification:** `node scripts/audio/extract-worklist.mjs` reports 48 units,
192 words, 4 witnesses, and 388 clips from 194 unique texts. The shared key
test passes in Node and a browser-style VM; `definition` resolves to the real
word and `accommodate` is present. Re-running produces byte-identical manifests.

### Phase 2 — Batch-generate MP3s via botnet Kokoro (Botnet repo)

Turn the worklist into the committed `public/audio/` folder of `af_heart` MP3s.
Decoupled from the app so the generator can change without touching the game.

- [x] Use the **existing deployed botnet service** — base URL
  `https://web-scraper-api.gist-backend.workers.dev`, caller key already
  provisioned as `WEB_SCRAPER_API_KEY` in `botnet/.env` (same value pair as
  `WEB_SCRAPER_BASE_URL`). No new provisioning. **Preflight before batching:**
  that URL only *queues* TTS jobs; a native macOS Kokoro worker must be online
  to drain the queue. Confirm one is with
  `pnpm check:tts-worker-health` and a single `pnpm prove-live:tts` round-trip
  against that base URL + key. If nothing is draining, start the local
  kokoro-worker per `botnet/README/docs/kokoro-worker-ops.md` and re-check.
- [x] Add `botnet/scripts/wordbreak-tts-batch.ts` (modeled on
  `tts-prove-live.ts`). Inputs: `--manifest <path-to-audio-manifest.json>`,
  `--base-url`, `--api-key`, `--out <dir>` (point `--out` at the wordbreak
  repo's `public/audio/`). For each clip: synthesize
  (`text` = `textOverride ?? text`, `voice:"af_heart"`, `speed` from the entry,
  `format:"mp3"`), poll `GET /v1/jobs/:jobId` to `completed`, download
  `GET /v1/tts/results/:jobId/audio` to `<out>/${file}`. Bounded concurrency
  (e.g. 4–6). **Idempotent:** skip a `${file}` that already exists and passes
  the MP3-header check, so reruns only fill gaps.
- [x] **Idempotency key must not pin a dead job.** Botnet idempotency is scoped
  `callerId+operation+key`, and a failed / `resultArtifactUnreadable` job would
  replay forever under a fixed `wordbreak:${key}`, so "re-run until zero
  failures" could never converge. Use a per-run nonce:
  `Idempotency-Key: wordbreak:${runId}:${key}` (or retry with a fresh key on
  failure). Within one run the key still dedupes accidental double-submits.
- [x] Validate each downloaded file the way `tts-prove-live.ts` does (ID3 tag
  or MP3 frame sync; `content-type: audio/mpeg`). Fail the clip, don't write a
  truncated file.
- [x] Emit a run report: counts of generated / skipped / failed, and total
  bytes. Re-run until zero failures.

**Verification:** `public/audio/` contains one MP3 per manifest entry; every
file plays in a local player as the `af_heart` voice; slow clips are audibly
slower. **QA all four witness words** (`definition`, `grammatical`, `preside`,
`medicinal`, normal + slow) — each must audibly stress the byte the UI claims
(`-NI-`, `-MAT-`, `-SIDE`, `-DI-`). Any that Kokoro flattens gets a
`textOverride` in the manifest and a regenerate. Total size a few MB
(≈ N clips × ~15 KB at 64 kbps).

### Phase 3 — Reconcile assets against the manifest (Wordbreak repo)

No cloud infra — just prove the committed asset set exactly matches the manifest
before wiring the client to it.

- [x] Add `scripts/audio/verify-assets.mjs`: for every clip in
  `audio-manifest.json`, assert `public/audio/${file}` exists and is a valid MP3
  (header check). Assert there are **no orphan** `.mp3` files in `public/audio/`
  that the manifest doesn't list (stale clips from an earlier gen → delete or
  bump `AUDIO_GEN`). Assert `public/audio/manifest.json` lists **exactly** the
  present `.mp3` set (this is the client's precache list — a mismatch means the
  client tries to `cache.addAll()` a missing file and the precache rejects).
  Non-zero exit on any mismatch.
- [x] Commit `public/audio/*.mp3`, `public/audio/manifest.json`, and
  `docs/audio/audio-manifest.json` together.

**Verification:** `node scripts/audio/verify-assets.mjs` exits 0; `git status`
shows the audio dir and manifest staged; file count matches the manifest clip
count.

**Execution evidence:** the Botnet preflight reported 3 fresh Kokoro workers
and a passing canary. The resumable batch produced 388/388 valid `af_heart`
MP3s (6.4 MiB total; the final repair run was 9 generated, 379 skipped, 0
failed). `ffprobe` showed every required witness has a slower clip, and all
eight required witness files completed local `afplay` playback.

### Phase 4 — Client cutover in `wordbreak_v2.html`

Rewire the three audio sites to the bundled clips; keep the game identical
otherwise.

- [x] Add `const AUDIO_GEN="g1";`, `const AUDIO_BASE="audio/";` (relative,
  same-origin), `normalize()`, and the **same** `fnv1a32` helper as the
  generator (copied verbatim; comment cross-links `scripts/audio/key.mjs` as the
  authoritative contract).
- [x] **Precache on load** (decision 5): fetch `audio/manifest.json`, open cache
  `wb-audio-${AUDIO_GEN}`, `cache.addAll()` the files, `navigator.storage.persist()`,
  and delete any `wb-audio-*` caches from older gens. Run it fire-and-forget
  after first paint so it never blocks the UI; if the fetch fails (first load
  offline), skip silently — `say()` still degrades correctly.
- [x] Keep **one module-level** `Audio` element (`let curAudio`), so a new clip
  stops the previous one — matching today's `speechSynthesis.cancel()` before
  each utterance. Without this, "▶ say it" then "▶ slow" overlap.
- [x] Rewrite `say(audioText, slow, fallbackText)` (line 168), **cache-first**:
  1. `curAudio?.pause(); speechSynthesis.cancel();`
  2. `const key = fnv1a32([AUDIO_GEN,"af_heart",slow?"s":"n",normalize(audioText)].join("|"));`
     — `normalize()` must match the generator exactly.
  3. `const url = AUDIO_BASE + key + ".mp3";` resolve to a source:
     `caches.match(url)` → `URL.createObjectURL(blob)`; else `url` directly
     (network, which also warms the HTTP cache).
  4. `curAudio = new Audio(src); curAudio.play().catch(fallback)`.
  5. Fall back to the current `SpeechSynthesisUtterance` path (speaking
     `fallbackText ?? audioText`, rate `slow?0.6:0.85`) on **both** the media
     `error` event **and** a rejected `play()` promise — guarded so the fallback
     fires **at most once** per click. All inside the click handler (user
     gesture — autoplay-safe). Revoke any object URL on `ended`/`error`.
- [x] `wireSay()` (line 172): pass the fallback through —
  `say(el.dataset.say, el.hasAttribute("data-slow"), el.dataset.fallback)`.
- [x] Witness button (line 961): `data-say="${esc(it.w)}"` (real-word Kokoro
  key) **plus** `data-fallback="${esc(it.sayAs)}"` so the rare last-resort
  browser-TTS path still speaks the intelligibility-tuned respelling. Keep
  `it.sayAs`/`stress` in the visible verdict line unchanged — that on-screen
  stress mark is the real pedagogical backstop if audio ever fails.
- [x] Answer buttons (lines 863–864) already use `w.a`; no `data-fallback`
  needed (fallback text defaults to the word itself).

**Verification:** `npm run dev`, open the game; wait for precache (Application →
Cache Storage shows `wb-audio-g1` populated with the full clip count). "▶ say
it" then "▶ slow" play the `af_heart` voice, the second click **stops** the
first (no overlap), and DevTools shows **no** `speechSynthesis` call. Then go
**fully offline** and replay several not-yet-clicked words plus a witness — all
still play Kokoro audio from cache, no network, no browser voice. Only after
`caches.delete("wb-audio-g1")` + offline does a clip fall back to browser TTS
(witness → respelling, answer → word); game stays playable. `git diff` touches
only `say()`/`wireSay()`, the precache/`AUDIO_*`/hash additions, and the one
witness `data-say` line.

**Execution evidence:** local Wrangler served the app at `http://localhost:8787/`;
the browser smoke rendered the home screen, completed a lesson, opened practice,
and ran the first compile beat with no console errors. The rendered contract
contains the cache/preload code and witness fallback attribute; the browser
environment did not expose Cache API storage, so full offline cache replay
remains a production-browser verification item.

### Phase 5 — Ship and verify in production

- [x] `npm run deploy` (syncs HTML → `public/index.html`, `wrangler deploy`
  pushes `public/` including `public/audio/`).
- [x] On `https://wordbreak.fun`: play a say-word and a witness; confirm
  `wordbreak.fun/audio/*.mp3` `200`s and correct voice; confirm
  progress/localStorage untouched.
- [x] Capture one consolidated note in `docs/notes/` (via **write-notes**):
  the audio architecture, the key/hash contract shared across two repos, the
  relaxed "no network calls" invariant, and how to regenerate after curriculum
  edits (Phase 1 → 2 → 3, then redeploy).

**Verification:** production plays the bundled audio; offline/missing-clip
fallback still works; note is committed.

**Execution evidence:** `npm run deploy` uploaded 400 new/modified assets and
deployed version `2fb78a6b-ad22-43ca-9cf7-661772f439ab`. Production returned
the new client and a 388-entry runtime manifest; a bounded live sweep fetched
all 388 entries as `audio/mpeg` with valid MP3 headers. The first highly
concurrent probe produced transient SPA fallbacks at the edge, so the final
proof intentionally uses concurrency 2 with retries. Offline replay is not
claimed from the in-app browser because its Cache API was unavailable.

## Hard requirements

- Voice is exactly **`af_heart`**; format **mp3**; two speeds
  (`1.0` normal, `0.7` slow).
- The generator and the client compute clip keys with **identical** hash +
  normalization logic (FNV-1a 32-bit over UTF-8 bytes of
  `[AUDIO_GEN,"af_heart",speedTag,normalize(text)].join("|")`, 8-char lowercase
  hex). A mismatch = silent 404s. `scripts/audio/key.mjs` is the contract; the
  inline client copy must match it byte-for-byte. A **checked-in test asserts
  identical output for fixed vectors in both Node and a browser/jsdom context**
  — this is the single most load-bearing invariant in the plan.
- Filenames are content-addressed (`AUDIO_GEN` + voice + speed + text folded
  into the hash). **Re-rendering any existing word requires bumping
  `AUDIO_GEN`** so the filename changes and no stale cached clip can survive.
- `audio-manifest.json` is generated from `UNITS`, never hand-edited (except
  the `textOverride` escape hatch), and is regenerated whenever curriculum
  words change. `verify-assets.mjs` must pass (every manifest clip present, no
  orphans) before deploy.
- The full corpus is **precached into the Cache API on load** (`wb-audio-${AUDIO_GEN}`,
  `navigator.storage.persist()`), and `say()` is **cache-first**, so after one
  online session all audio plays offline with no browser voice. No service
  worker — the single-HTML property is preserved. `public/audio/manifest.json`
  (the precache list) must exactly match the shipped `.mp3` set.
- `speechSynthesis` fallback stays in `say()` as the last resort (never-online
  device, or a key/asset mismatch). The game must remain fully playable when a
  clip is missing.
- No change to scoring, the four beats, flag/aim logic, localStorage schema
  (`wb2`), or the single-file nature of the app.
- Audio is served **same-origin from `public/audio/`** as committed static
  assets — no R2, no extra hostname, no Worker, no CORS.

## Rollback / kill switch

- **Client:** `say()` already falls back to `speechSynthesis` on audio error.
  Full revert = restore the original `say()` body and the line-961 `data-say`;
  one small diff, no data migration.
- **Assets:** `public/audio/` is additive. Deleting it (or reverting the
  `say()` rewrite) makes clips 404 → the client silently falls back to browser
  TTS. Nothing else breaks.
- Generation (Phases 1–3) leaves the shipped game untouched until Phase 4, so
  the risky work is isolated from production.

## Resolved

- **Generation transport** — the **existing deployed botnet service**
  (`https://web-scraper-api.gist-backend.workers.dev`, caller key
  `WEB_SCRAPER_API_KEY` already in `botnet/.env`). A native macOS Kokoro worker
  must be online to drain the queue during the batch (Phase 2 preflight).
- **Offline scope** — **guaranteed offline audio** via Cache API precache of the
  whole corpus (decision 5), not lazy best-effort. No service worker.
- **Regeneration trigger** — **manual**, by design: run extract → generate →
  verify (Phases 1–3) then redeploy. No `audio:rebuild` wrapper.

## Open questions

- None blocking. (If the corpus ever grows past a few MB, revisit whether
  precache-all-on-load should become preload-on-idle to spare first-load
  bandwidth — not a concern at current size.)
