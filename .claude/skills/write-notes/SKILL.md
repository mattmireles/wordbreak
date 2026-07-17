---
name: write-notes
description: Write or update repo notes under docs/notes. Use when the user wants debugging notes, investigation notes, audit notes, or institutional memory captured in the repo. Prefer updating the right high-level notes document over creating a fresh file for every session. Do not use for plans, product docs, or inline code comments.
---

# Write Notes

## Purpose

Capture useful institutional memory in `docs/notes/` without note sprawl.

## Use When

- Bug, investigation, audit, or debugging trail should live in the repo.
- A change should leave durable troubleshooting context.

## Do Not Use When

- The user wants a plan (`create-plan`).
- The output belongs in `README.md` / `methodology.md` / `curriculum.md`.
- The content is inline code documentation.
- Throwaway session chatter with no lasting value.

## Procedure

1. Read [references/index.md](references/index.md) first.
2. Scan `docs/notes/` for the best existing home before creating a new file.
3. Default to consolidation: update the right topic file; add a self-contained
   issue section using the notes template.
4. Create a new file only for durable recurring topics.
5. Use topic-based names — not dates/sessions.
6. Keep high signal: summary, symptom, root cause or `TBD`, related docs, fix /
   status, verification.
7. Keep active issues near the top; mark resolved when done.

## Handoff Rules

- `markdown` for markdown cleanup
- `create-plan` when a real plan is needed
