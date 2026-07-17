---
name: documentation
description: Write or review inline code documentation that captures domain knowledge, non-obvious constraints, non-greppable cross-file contracts, and state lifecycle. Use when the task is adding or reviewing comments, file headers, state docs, or constant rationale. Do not use for README files, markdown docs, plan documents, or code changes where comments are incidental.
---

# Documentation

## Purpose

Document what a future editor cannot safely derive from the code itself.

## Use When

- Adding or reviewing comments / headers in `wordbreak_v2.html` (or future code).
- Documenting state lifecycle, constant rationale, or curriculum↔runtime contracts.
- A review flags missing or low-quality documentation.

## Do Not Use When

- Writing README, plan, or notes documents.
- General code changes where docs aren’t the focus.
- Markdown formatting issues (use `markdown`).

## Procedure

1. Read [references/index.md](references/index.md) first.
2. Inspect the target and the smallest related set of files.
3. Add or tighten docs only for domain knowledge, non-obvious constraints,
   non-greppable contracts, and state lifecycle.
4. Prefer short durable comments over boilerplate.
5. Do not add call graphs, line-by-line prose, or comments likely to drift.
6. If the missing context belongs in product docs or notes, update those instead
   of burying everything in code comments.

## Handoff Rules

- `debug` if the real issue is a runtime bug
- `markdown` / `write-notes` for doc-file work
