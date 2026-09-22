---
name: missingmanual
description: Turn a research question into a checked guide or paper list, then save it into this repository. Use when primary documentation does not answer a concrete technical question, or the user explicitly asks for MissingManual.
---

# MissingManual

One skill, two underlying actions. Infer which one (or which combination) the
question actually needs; do not ask the user to pick a tool by name unless
their own words are ambiguous.

## Choosing the action

| Situation | Action |
| --- | --- |
| A broad "how do I / why does X" question with no explicit deliverable | Infer intent from the question and repo context; prefer the smallest sufficient action below |
| "Write me a guide on...", "explain how... and save it" | `create_guide` |
| "Find papers on...", "what research exists for..." | `find_papers` |
| User says "just show me, don't save anything" / "links only" | Run the action, return the result in the conversation, write no repo files |
| User explicitly asks for both a guide and papers in one request | Run both, but treat this as one approved combined scope — do not silently double the spend beyond what they asked for |

Never invoke both actions for a plain single-topic question. One remote
action is the default; a second one requires the user's own words asking
for it.

## Procedure

1. Confirm the research question in one sentence back to the user before
   spending anything, unless they already stated it unambiguously.
2. Check whether this exact question was already answered in this repo
   (existing guides/papers under its normal docs convention) before
   requesting new research.
3. Call `create_guide` or `find_papers` with the topic and a maximum
   authorization of `maxTotalChargeUsdMicros: 25000000` ($25). You will get
   back a `handle` (an opaque local id — never a raw job id or credential)
   and a `status`.
4. Handle the returned `status`:
   - `payment_required` / `billing_action_required`: show the returned
     `actionUrl` to the user and say what it's for (approve a card, or add
     one for automatic future requests). Never open, submit, or fill in
     anything on that page yourself.
   - `authorized` / `submitted`: proceed to polling.
5. Poll `get_result` with the same `handle` roughly every 30 seconds.
   Research can take up to 90 minutes. Never call `create_guide`/`find_papers`
   again for the same question merely because the result is still pending —
   the same `handle` always resumes the same paid job, even across a
   restart of this session.
6. On success, and unless the user asked for links-only / no file changes,
   save the result with the matching tool rather than writing files
   yourself — both already detect this repo's existing guides/papers
   convention (falling back to `docs/research/{guides,papers}` only when
   none exists), write atomically and idempotently, and add an index
   entry:
   - For a guide: call `save_guide` with the same `handle`, the `topic`,
     the `markdown` and `receipt` from `get_result`.
   - For papers: call `save_papers` with the same `handle`, the `markdown`
     from `get_result`, and its `sources` array when one was returned. The
     structured list is authoritative; pass it whenever it exists rather
     than letting the tool fall back to scanning prose. `save_papers`
     reports each candidate's outcome (`ingested`, `blocked`, etc.). It
     converts ordinary text PDFs to Markdown; a source is blocked only when
     it cannot be downloaded, safely converted, or contains no extractable
     text.
   Add reciprocal links between the new file and anything it supersedes or
   supports yourself — that judgment call is not automated.
   When `get_result` returns a `quality` object, report its
   `unresolvedLimitations` to the user rather than presenting the result as
   unconditionally verified. A guide's own Verification section lists any
   claim a primary source contradicted; treat those corrections as more
   current than the body text above them.
7. On failure or `pricing_gap`, report the status honestly; nothing was
   charged. Do not retry automatically — ask the user before spending
   again on the same question.

## Constraints

- Never put a credential, capability, or raw job id in a message to the
  user or in a saved file. The `handle` is the only identifier that ever
  appears in the conversation.
- Never claim a result is "verified" beyond what its receipt actually
  states.
- Enrollment (`missingmanual enroll`) is optional and separate from this
  skill's own actions; only mention it if the user is repeatedly approving
  checkout for every request and would rather do it once.
