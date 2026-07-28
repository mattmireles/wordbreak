---
name: deploy
description: Deploy Wordbreak's single Cloudflare Worker with static assets and verify its generated HTML and pre-generated Kokoro MP3 corpus. Use for shipping, previewing, or proving production. Production requires explicit authorization.
---

# Deploy Wordbreak

1. Run `npm run sync:public`.
2. Run the audio key tests, `node scripts/audio/extract-worklist.mjs`, and
   `node scripts/audio/verify-assets.mjs`.
3. Confirm the runtime manifest exactly matches committed MP3 files.
4. Run `npm run deploy`, which owns safe Cloudflare credential loading.
5. Verify production HTML and representative MP3s by content type and bytes;
   HTTP 200 alone is insufficient because SPA fallback can return HTML.
6. Verify missing assets do not masquerade as audio.
