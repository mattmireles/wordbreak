---
name: botnet
description: Regenerate Wordbreak's pre-generated Kokoro audio through the sibling Botnet service. Use for TTS worker preflight, manifest-driven batch generation, retries, MP3 validation, repair runs, or corpus version bumps.
---

# Botnet for Wordbreak audio

1. Derive the worklist from inline `UNITS`; never maintain a second curriculum.
2. Run Botnet's worker-health and live TTS preflight.
3. Use the checked-in Botnet batch driver with voice `af_heart` and the
   generated manifest.
4. Use bounded concurrency and a fresh idempotency key for each retry.
5. Accept only `audio/mpeg` with valid ID3/frame bytes.
6. Run `scripts/audio/verify-assets.mjs` after generation.
7. Bump `AUDIO_GEN` when existing spoken assets intentionally change.
