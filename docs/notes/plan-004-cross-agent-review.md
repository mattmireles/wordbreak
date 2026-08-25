# Plan 004 cross-agent review

Fresh Codex and Claude Code read-only reviews ran on 2026-08-05 against the
first saved draft of
[Plan 004](../plans/004-private-parent-reporting-plan.md), the live
`wordbreak_v2.html` ledgers, deployment files, README, methodology, and Plans
002–003. Neither reviewer modified the repository.

## First-draft grades

| Reviewer    | Architecture | Correctness risk | Complexity debt | Overall |
| ----------- | -----------: | ---------------: | --------------: | ------: |
| Codex       |            C |                D |               C |       D |
| Claude Code |           B+ |               C+ |              A- |      C+ |

Both rejected the draft as not implementation-ready. The shared reason was
truthfulness: the proposed email promised fields that the current capped local
ledgers could not derive, and several failure states could be presented as Luca
not practicing when the real problem was missing sync evidence.

The revised event-based draft was reviewed again. Claude improved it to A− / C+
/ B+, while Codex remained C / D / C. Both still rejected it: raw word rows and
a separate outbox created more privacy and crash-consistency surface than the
weekly report required; partial drains could masquerade as complete coverage;
multi-device revisions conflicted; session terminal transitions and frozen
delivery bytes were still incomplete.

The aggregate-only revision received a third independent review. Codex graded
it C / D / C and Claude B+ / C+ / B−; both again withheld implementation
approval. Their remaining objections were concrete protocol gaps, not a request
for more product scope: guarded enrollment needed trigger atomicity, stream
epochs needed explicit completeness ownership, higher revisions needed
componentwise monotonicity, midnight sessions and multi-tab writers needed exact
rules, local storage needed a hard budget, and Postmark ambiguity needed a
complete response-state table.

## Findings integrated into the plan

- Gameplay creates report-sufficient daily counters only. Legacy activity is a
  bounded aggregate with explicit unknown masks, never invented daily history.
- The transport is reconstructed from bounded, acknowledged day revisions;
  componentwise monotonic updates and explicit gaps make partial state visible.
- The global browser secret was replaced with single-use enrollment and scoped,
  hashed, revocable device credentials.
- Every report field now has a numerator, denominator, time basis, evidence
  floor, and legacy/unknown rule.
- Active time uses a five-second visible-and-active sampler, splits at midnight,
  and never includes historic wall-clock duration.
- Report weeks use Luca's local-day ledger rather than UTC midnight; late syncs
  and stale coverage are named.
- Postmark delivery now distinguishes accepted, definitive failure, and
  ambiguous `unknown`; ambiguous transmission is never automatically resent.
- The D1 schema, endpoints, origin policy, request bounds, privacy lifecycle,
  retention, deletion, canary boundary, and fail-closed deployment order are
  explicit.
- The provisioning utility is tracked and reviewed; secrets remain unprinted
  inputs, not unreviewed code or Git artifacts.
- README truth updates and static HTML/SPA/audio production gates are part of
  the release phase.
- A guarded enrollment insert plus `AFTER INSERT` trigger makes expired,
  replayed, and concurrent codes unable to mutate dependent state.
- `reporting_epochs` defines ownership, cutover partiality, accepted/drained
  revisions, and gaps; a report selects one epoch owner per day.
- One-tab writer election, a measured 128 KiB reporting budget, zero-heartbeat
  rollover rules, and save-failure behavior close browser consistency gaps.
- Incomplete weeks use `at least` counts and suppress rates/profile rankings.
- Delivery now uses HMAC address fingerprints, exact retry/unknown/definitive
  classifications, operator suppression checks, and no public canary endpoint.
- The stale Pagesumo/current custom-domain split must be resolved by exporting
  Luca's origin-bound progress before pairing on canonical `wordbreak.fun`.

## Second-round deletion

The final plan does not patch around the raw-event system. It removes it:

- D1 stores daily aggregate counters and module IDs, never words.
- One browser is authoritative; re-pair creates an explicit stream epoch.
- Reporting summaries live inside the same `wb2` save as gameplay; transport is
  reconstructed from dirty day revisions rather than a second durable outbox.
- A drained checkpoint, daily zero heartbeat, complete-through day, and gap
  ranges make coverage—and therefore zero-data copy—provable.
- Session completion/abandonment is an explicit atomic state transition.
- Frozen report model/text/HTML and expired-lease→unknown close the Postmark
  crash window honestly.
- One daily Cron owns missed-Monday generation, retry sweep, and age-based
  cleanup even when collection/email are disabled.
- The checked-in `test:reporting-integration` gate now boots the real Worker
  against local D1, proves origin rejection, single-use enrollment, numeric
  module sync, throttling, idempotence, credential revocation, and then removes
  its temporary learner while restoring ingestion to off.

## Raw artifacts

Raw reviewer output remains gitignored under the three
`tmp/cross-agent-audits/plan-004*-20260805/` directories. It is evidence for
this drafting session, not canonical product documentation.
