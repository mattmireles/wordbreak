# Kokoro audio notes

## Pre-generated static corpus — 2026-07-17 — resolved

**Summary:** Wordbreak ships two pre-generated `af_heart` Kokoro MP3 clips for
each unique answer or witness word. The app computes content-addressed keys and
plays same-origin assets from `public/audio/`, with a browser speech fallback.

**Symptom:** Browser speech synthesis produced inconsistent voices and stress
patterns across devices, while the product still needs to work after the first
online load.

**Repro:** Run `node scripts/audio/extract-worklist.mjs`, then inspect
`docs/audio/audio-manifest.json` and `public/audio/manifest.json`. Verify with
`node scripts/audio/verify-assets.mjs`.

**Root cause:** `SpeechSynthesisUtterance` delegated pronunciation and voice
selection to each device. The curriculum already contained the authoritative
spoken strings in `UNITS`, but there was no generated asset contract.

**Fix / status:** The generator extracts `UNITS` directly from
`wordbreak_v2.html`, emits normal (`1.0`) and slow (`0.7`) `af_heart` clips, and
uses FNV-1a 32-bit over `[gen, voice, speedTag, NFC-normalized text]`. The
identical hash and normalization logic lives in `scripts/audio/key.mjs` and
the inline client. The full corpus is precached in `wb-audio-g1` when the page
is online, served cache-first, and stale generations are removed. The promise
"no network calls after load" is relaxed only for the first cache fill; after a
successful fill, audio playback is offline. A missing asset falls back to
speech synthesis, and witnesses use `sayAs` only for that fallback.

To regenerate after curriculum edits:

1. Run `node scripts/audio/extract-worklist.mjs`.
2. Preflight Botnet and run `scripts/wordbreak-tts-batch.ts` with the manifest,
   caller key, and `public/audio/` output directory.
3. Run `node scripts/audio/verify-assets.mjs` and commit the manifest/assets.
4. Bump `AUDIO_GEN` in both key contracts when re-rendering an existing word,
   then redeploy.

**Verification:** proven — 48 units, 192 words, 194 unique texts, 388 valid
MP3s, exact runtime manifest reconciliation, Node/browser key vectors, Botnet
worker canary, resumable batch with zero final failures, local playback of all
four witness pairs, local browser smoke, production deployment, and a bounded
live sweep of all 388 production MP3 URLs. The in-app browser did not expose
Cache API storage, so full offline replay remains unverified in this harness.

**Related:** [README.md](../../README.md), [methodology.md](../../methodology.md),
[plan 001](../plans/001-pregenerated-kokoro-audio-static-plan.md),
[audio manifest](../audio/audio-manifest.json),
[key contract](../../scripts/audio/key.mjs).
