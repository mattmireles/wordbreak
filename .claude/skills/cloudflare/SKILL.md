---
name: cloudflare
description: Work on Wordbreak's narrow Cloudflare Workers Static Assets deployment, SPA fallback, custom domain, cache behavior, headers, and scripts/deploy.mjs credential loading. Do not introduce D1, R2, Queues, or a dynamic backend without an explicit product requirement.
---

# Cloudflare for Wordbreak

Start with `wrangler.jsonc`, `package.json`, and `scripts/deploy.mjs`.
Wordbreak is one static-assets Worker. Preserve same-origin `audio/` URLs,
correct `audio/mpeg` responses, cacheability, and SPA behavior without allowing
fallback HTML to count as a valid MP3.
