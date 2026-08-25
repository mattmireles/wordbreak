# Plan 004 — Private parent reporting

## Goal

Give Luca's parent one concise weekly email showing accomplishment, practice
consistency, estimated active time, delayed-review performance, and the spelling
mechanisms that need work. Preserve Wordbreak's one-button learner experience
and local-first operation: no learner account, no parent dashboard, no visible
daily surveillance, and no dependency on sync, D1, Cron, or Postmark for play.

## Context

- Progress is currently stored only in browser `localStorage` under `wb2`:
  [README.md](../../README.md) §8–§9.
- The existing observer metrics and session lifecycle came from
  [Plan 002](002-measured-placement-engine-plan.md) and
  [Plan 003](003-budgeted-session-compiler-plan.md). `wordbreak_v2.html` remains
  authoritative for the learning loop, SRS, measured E-code profile, and inline
  curriculum.
- Deployment is one Cloudflare Workers Static Assets project. The explicit
  reporting requirement justifies adding a small Worker API and dedicated D1
  database; same-origin audio, SPA fallback, and static cache behavior remain
  release gates.
- The sibling `../gist/.env` contains the authorized Cloudflare and Postmark
  credential names. Utilities may read approved values without printing them;
  values never enter source, Wrangler vars, request URLs, logs, or Git history.
- This is reporting only. Assessment and content each receive their own plan and
  data contract later.
- **Review provenance:** three fresh Codex and Claude Code review rounds rejected
  earlier drafts. The first exposed non-derivable metrics, false zero-data copy,
  global browser credentials, UTC grouping, and ambiguous Postmark delivery.
  The second showed that a raw event/outbox architecture still created privacy,
  crash-consistency, partial-drain, and multi-device state problems. The
  source-verified findings are summarized in
  [docs/notes/plan-004-cross-agent-review.md](../notes/plan-004-cross-agent-review.md).
  This revision deletes server-side word history entirely.
- The live origins are split: `wordbreak.fun`/`www.wordbreak.fun` serve the
  current game while the README-linked `matt.pagesumo.com/wordbreak` serves an
  older build. Because `localStorage` is origin-bound, enrollment is blocked
  until Luca's `wb2` is exported from the origin he used and imported into
  canonical `https://wordbreak.fun`. Alternatives then redirect;
  `workers_dev` and previews are disabled.

## What ships

1. A minimal `/api/reporting/*` Worker surface alongside the existing assets.
2. A dedicated `wordbreak-reporting` D1 database containing only daily
   aggregates, current aggregate state, credentials/config, and frozen reports.
3. One authoritative reporting browser, paired by a short-lived single-use
   enrollment link.
4. A daily sync heartbeat and serialized background sync pump.
5. A private Monday email, with daily retry/retention work handled by one Cron.
6. Observer-only connection/coverage status. Luca's ordinary home and session
   screens remain unchanged.

## Decisions

### 1. Email first; delete Web Push and the remote dashboard

Email satisfies the push requirement without service workers, VAPID,
notification permissions, cross-device subscriptions, or parent authentication.
The existing local observer panel remains the detailed view. Assessment-result
email can reuse this delivery path later.

### 2. One authoritative device and one server-issued stream epoch

A tracked operator CLI creates a server-owned learner row and a random 256-bit,
30-minute, single-use enrollment code. Only its SHA-256 hash enters D1. The raw
code is copied—not printed—as
`https://wordbreak.fun/#report-enroll=<base64url>`; fragments never reach HTTP
logs. After a one-time disclosure/confirmation, the browser exchanges the code
for `{learnerId, deviceId, streamEpoch, token, serverRevision}`. D1 stores only
the token hash. The credential lives in `wb2-report-credential`, separate from
`wb2`, and expires after 365 days.

Enrollment uses one guarded `INSERT ... SELECT` into `device_credentials`; an
`AFTER INSERT` trigger performs every dependent mutation. If the code is
expired, replayed, or concurrently consumed, the insert creates zero rows and
the trigger cannot revoke a credential, consume a code, or rotate a stream.

A same-browser credential rotation retains its stream epoch and revision. A
replacement browser creates a new epoch, closes the old epoch, marks the switch
day partial, and never merges browser states. Old tokens are rejected. Reports
choose exactly one epoch owner for each day, so overlapping summaries cannot be
double-counted. Browser disconnect revokes only that device; global disable,
recipient change, and deletion are operator-only actions.

### 3. Sync report-sufficient daily aggregates, never word history

No target words, incorrect spellings, free-form writing, sentences, prompts, or
raw encounter records leave the browser. `P.reporting.days[YYYY-MM-DD]` holds a
small Los Angeles-calendar bucket:

```js
{
  revision,
  activeMs,
  practiceEvents, clean, liveAim,
  reviewEvents, reviewClean, reviewLiveAim,
  sessionsStarted, sessionsCompleted, sessionsAbandoned,
  bonusStarted, bonusCompleted,
  modulesCleared: ["5.4"],
  codes: { E1: { seen, clean, aim }, E5: { seen, clean, aim } }
}
```

The current point-in-time state is also aggregate-only: cleared module IDs,
docs count, due count, `codeProfile()` rows, and coverage metadata. Later plans
must justify any additional assessment/content records independently.

### 4. Reporting metadata commits atomically with gameplay

`P.reporting` lives inside `wb2`, so the daily aggregate update, session state,
SRS/profile transition, and log entry share one serialization/write. `saveP()`
returns success/failure. Sync is triggered only after the authoritative `wb2`
write succeeds; if the existing quota-recovery trim succeeds, the aggregate is
still present in that same recovered write. If both writes fail, neither the
game transition nor its report summary is claimed persisted.

Each reporting-relevant transition increments `P.reporting.sourceRevision` and
the affected day's revision. The transport queue is reconstructed from daily
buckets whose revisions exceed acknowledged revisions; there is no second large
outbox competing for quota. Keep 60 days of acknowledged buckets locally. The
reporting portion of `wb2` has a measured 128 KiB ceiling: compact acknowledged
buckets first, then evict the oldest unacknowledged bucket into an explicit gap,
before trimming the core log. A bounded 20-entry dead-letter list records only
day/revision/error codes, sets `incompleteSince`, and is observer-visible. If
quota recovery still fails, do not sync the unsaved in-memory transition;
retain the current screen and offer a storage retry.

Boot reconciliation validates the ledger, zero-fills every missing day between
the last intact day and today, preserves higher revisions, and marks—not guesses
through—any corrupt/missing interval. A date-rollover timer and visibility
resume create the next zero heartbeat. A day not opened after a report period
ends is stale coverage, never proof of no play. Crash fixtures stop after every
local write and acknowledgement boundary.

### 5. Los Angeles report days are independent of device travel

Use a new `reportDay(timestamp)` based on `Intl.DateTimeFormat` with the fixed
`America/Los_Angeles` zone, returning `YYYY-MM-DD`. Do not reuse current
`localDay()`, whose device offset changes while traveling. Legacy rows are not
rewritten into prospective daily buckets. Enrollment saves one bounded
`legacy_json` snapshot with its observed window, recoverable counts, and
explicit unknown masks; it does not invent review/module provenance,
module-clear dates, active time, or complete coverage.

The report period is `[previous Monday 00:00, current Monday 00:00)` in Los
Angeles. The scheduled handler derives boundaries from `scheduledTime` with the
same zone. Late-arriving summaries never mutate an accepted report; the next
email names them as late-synced prior activity. Every report states its data
cutoff.

### 6. Sync is a revisioned checkpoint protocol, not an event queue

`POST /api/reporting/sync` accepts at most 14 daily buckets and 48 KiB. A daily
bucket is mutable and replaces only when its revision is higher; same revision
and different server-computed canonical hash returns a terminal row conflict.
The server computes hashes from schema-versioned, sorted-key UTF-8 JSON.
Higher revisions must be componentwise monotonic: counters and active time never
decrease, cleared-module sets are supersets, and normalized E-code counts never
decrease. Reductions require an operator repair or a new epoch.

The response separately returns accepted day revisions and terminal
`{day,revision,error}` rejections. The client dead-letters terminal rows and
continues. A lower revision is an acknowledged no-op returning the stored
revision. Whole-request 404/405/409 pauses the pump as a kill switch and does
not dead-letter rows; transport errors, 429, and 5xx retry. Once all dirty days
are acknowledged, the client sends a final checkpoint with `outboxDepth:0`,
`sourceRevision`, `earliestCompleteDay`, `completeThroughDay`, and permanent gap
ranges. Only that drained checkpoint advances `last_complete_sync_at` and
coverage. A partial batch can never certify a complete week.

The browser sends one heartbeat on the first visible load of each report day,
even with no practice, and creates/syncs a zero bucket for that day. Therefore a
fully covered empty week can be distinguished from broken reporting.

Only one tab may write or sync, elected with `navigator.locks` and
`BroadcastChannel`, with a localStorage lease fallback. A secondary tab asks the
learner to close the other tab rather than producing another stream.

The sync pump is serialized and never awaited by gameplay: coalesce triggers;
8-second timeout; jittered backoff from 5 seconds to 5 minutes; retry on
`online`, visible resume, next successful save, and next day's heartbeat; stop
permanently on 401 until re-paired. `pagehide` may issue at most one prebuilt
`fetch(...,{keepalive:true})` request with Authorization and ≤48 KiB.
`sendBeacon` and credentials in URLs are prohibited.

### 7. Session terminal state and active time become truthful locally first

Before history insertion, create one session ID and put it on `P.session`, its
history row, and new local word rows. The local session schema adds
`status`, `revision`, and `activeMs`. Allowed transitions are only:

```text
in_progress -> completed
in_progress -> abandoned
```

Starting increments the day's nonbonus or bonus start counter once. The final
word's existing atomic save must also set history/current session to
`completed`, set `endedAt`, flush `activeMs`, increment completion counters, and
advance revision. The completion screen and navigation become side-effect-free.
A stale local-day session becomes `abandoned` before replacement. Legacy null
rows become `unknown`, never abandoned by inference.

A 5-second sampler credits
`min(performance.now()-lastSample,5000)` only while a compiled session is on
`docs` or `run`, the document is visible, and a pointer, keyboard, or audio-play
action occurred in the prior 30 seconds. Idle re-arm resets the baseline. Pause,
terminal transition,
visibility loss, pagehide, and reload flush the delta to the matching session
and report-day bucket. Sleep earns at most 5 seconds and a crash loses at most
5 seconds. Session start/completion/abandonment counters belong to the Los
Angeles start day; active milliseconds are split across actual report days.
Historic wall-clock duration remains separate and is never added to estimated
active minutes.

### 8. Every email claim has a fixed provenance rule

<!-- markdownlint-disable MD013 -->

| Field           | Calculation                                           | Honesty rule                                           |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| Active days     | Distinct covered days with `practiceEvents>0`         | Works without sessions; unknown across a gap           |
| Habit sessions  | Sum nonbonus starts/completions/abandonments          | In-progress and legacy unknown are separate            |
| Bonus work      | Sum bonus starts/completions                          | Named separately from habit completion                 |
| Active minutes  | Sum `activeMs`, rounded to nearest minute             | Labeled estimated; excludes legacy wall time           |
| Practice        | Sum `practiceEvents`                                  | Aggregate count, never a word list                     |
| First-pass      | `(clean-reviewClean)/(practiceEvents-reviewEvents)`   | Below 4 first-pass events shows counts and `measuring` |
| Live aim        | `liveAim/practiceEvents`                              | Below 4 shows counts and `measuring`                   |
| Delayed review  | `reviewClean/reviewEvents`                            | Legacy unknown excluded; below 4 says measuring        |
| Newly cleared   | Union of false→true module IDs recorded during period | Existing clears at enrollment are `previously cleared` |
| Current due     | Latest accepted state snapshot                        | Point-in-time, labeled with complete-sync time         |
| Pattern profile | Latest decayed profile with existing evidence bands   | Current profile, not weekly performance                |
| Weekly codes    | Sum aggregate code counts                             | Needs ≥4 observations; no words leave browser          |

<!-- markdownlint-enable MD013 -->

`logWord` increments `practiceEvents`, plus `clean` when `S.firstClean` and
`liveAim` when `S.aimGood`. Review attempts additionally increment
`reviewEvents`, `reviewClean`, and `reviewLiveAim`. E0 contributes to totals but
is absent from the E-code profile map. A module clear is counted only on its
false→true transition. The state snapshot is captured only after the same
successful save. These rules are contract fixtures, not renderer conventions.

`No practice recorded` is allowed only when every report day has an accepted
summary, the post-period heartbeat/checkpoint is drained, no gap intersects the
week, and `practiceEvents===0`. Otherwise: `Either no play was recorded or
reporting needs attention — last complete sync …`. Unknown is never rendered as
zero. If any gap, stale interval, or partial epoch intersects a week, counts are
labeled `at least`; rates and strongest/weakest pattern claims are suppressed.
Late data produces only a nonquantified notice because the frozen report is not
rewritten.

### 9. Freeze reports before delivery and treat ambiguity honestly

One daily Cron (`0 16 * * *`) always runs. On Monday it idempotently generates
the most recently completed missing weekly report; on every day it sweeps
retryable reports and performs retention cleanup. If Monday is missed, Tuesday
generates the missing period. A definitive provider failure retries daily and
parks after 20 attempts. Cleanup runs even when ingestion/email is disabled.

Generation transactionally freezes canonical report-model JSON, plain text,
HTML, notification-safe subject (`Your weekly Wordbreak report`), template
version, received-at cutoff, data cutoff, body/request hashes, Postmark stream,
and sender/recipient domain-separated HMAC fingerprints made with a dedicated
secret. Retries/resends use those exact
stored bytes and require current configured address fingerprints to match.

Delivery states are `pending`, `sending`, `accepted`, `definitive_failure`, and
`unknown`. A conditional claim must change exactly one row. Success requires
HTTP success, valid JSON, `ErrorCode===0`, and nonblank `MessageID`. Any expired
`sending` lease becomes `unknown`, never pending. A crash/network loss after
transmission begins is also `unknown` and never automatically resends because
Postmark has no idempotency key. Only a proven pre-transmission or explicit
provider rejection retries automatically. Operator reconciliation/manual resend
is deliberate and recorded. Provider acceptance is not claimed as inbox receipt.

Set `TrackOpens:false`, `TrackLinks:"None"`, and no learner data in Postmark
tags, metadata, headers, or logs. Before `fetch`, failures are retryable. Once
`fetch` is called, aborts, throws, timeouts, 5xx, and expired leases are
`unknown`. A 429 is retryable. HTTP 401/406/422 or a valid provider rejection is
definitive. A malformed 2xx or response lacking both `ErrorCode===0` and a
nonblank `MessageID` is `unknown`. Postmark 406 immediately disables email.
Suppression/bounce status is checked by the operator runbook before re-enable;
no public webhook is added. An inactive/suppressed recipient requires
correction plus a labeled canary.

### 10. Configuration and privacy are operational, not prose-only

Runtime switches live in D1 `service_config`: `ingest_enabled` and
`email_enabled`, both `0` initially. The tracked operator
CLI mutates them with conditional writes, reads them back, and prints state but
never values. If D1/config is unavailable, collection and email fail closed
while assets continue. Cron stays registered for retention cleanup.

The recipient is a Worker secret configured from the operator environment; the
sender comes from the approved Gist verified-sender key. Actual addresses stay
out of tracked prose. The normal deploy process receives only Cloudflare
credentials; Postmark/email material is handled by the explicit provisioning
command. Process environment overrides env-file values. Every mutating command
asserts expected account ID, Worker name, D1 ID, and custom domains first.

Email eligibility requires four auditable stages: guardian authorization,
reporting start, provider-accepted canary, and guardian confirmation that the
canary reached the mailbox. Parent authorization occurs through enrollment. The
enrollment screen tells Luca once: private aggregate practice summaries go to
his parent; typed mistakes and writing stay on his device. Retain daily
summaries for 365 days and frozen
report metadata/bodies for 400 days. Delete expired enrollment codes and revoked
credentials after 30 days. Verify Postmark account retention before canary.
Authenticated device disconnect revokes that device; the operator delete
command transactionally deletes the learner and cascades all D1 data. D1 Time
Travel may retain deleted data for the provider recovery window; disclosure and
delete output state that limitation instead of claiming immediate backup erasure.

Incident response: disable ingest/email in D1, revoke the credential, inspect
bounded metadata-only logs, rotate Wordbreak-only secrets, and re-enroll. Never
reuse the Gist admin token, Cloudflare API token, or a Gist application secret as
a browser credential.

## Exact D1 schema

All times are Unix milliseconds. Tables are `STRICT`; booleans use checked
integers. Content-era bounds allow planned expansion while the Worker owns
current validation. No curriculum word list is duplicated server-side.

```sql
CREATE TABLE learners (
  id TEXT PRIMARY KEY CHECK(length(id)=36),
  active_epoch TEXT NOT NULL CHECK(length(active_epoch)=36),
  created_at INTEGER NOT NULL,
  guardian_authorized_at INTEGER,
  reporting_started_at INTEGER,
  canary_accepted_at INTEGER,
  mailbox_confirmed_at INTEGER,
  disabled_at INTEGER,
  last_sync_at INTEGER,
  last_complete_sync_at INTEGER,
  earliest_complete_day TEXT,
  complete_through_day TEXT,
  gaps_json TEXT NOT NULL DEFAULT '[]' CHECK(length(gaps_json)<=8192)
) STRICT;

CREATE TABLE reporting_epochs (
  id TEXT PRIMARY KEY CHECK(length(id)=36),
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  start_day TEXT NOT NULL CHECK(length(start_day)=10),
  ended_at INTEGER,
  end_day TEXT,
  cutover_partial INTEGER NOT NULL DEFAULT 0 CHECK(cutover_partial IN (0,1)),
  max_accepted_revision INTEGER NOT NULL DEFAULT 0 CHECK(max_accepted_revision>=0),
  max_drained_revision INTEGER NOT NULL DEFAULT 0 CHECK(max_drained_revision>=0),
  earliest_complete_day TEXT,
  complete_through_day TEXT,
  gaps_json TEXT NOT NULL DEFAULT '[]' CHECK(length(gaps_json)<=8192)
) STRICT;
CREATE INDEX epoch_learner ON reporting_epochs(learner_id,started_at);

CREATE TABLE enrollment_codes (
  code_hash TEXT PRIMARY KEY CHECK(length(code_hash)=64),
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  requested_epoch TEXT NOT NULL CHECK(length(requested_epoch)=36),
  same_stream INTEGER NOT NULL CHECK(same_stream IN (0,1)),
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER
) STRICT;
CREATE INDEX enrollment_expiry ON enrollment_codes(expires_at,used_at);

CREATE TABLE device_credentials (
  id TEXT PRIMARY KEY CHECK(length(id)=36),
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  stream_epoch TEXT NOT NULL REFERENCES reporting_epochs(id) ON DELETE CASCADE,
  enrollment_code_hash TEXT NOT NULL UNIQUE CHECK(length(enrollment_code_hash)=64),
  token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash)=64),
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  last_used_at INTEGER, revoked_at INTEGER
) STRICT;
CREATE INDEX device_learner ON device_credentials(learner_id,revoked_at);

CREATE TABLE daily_summaries (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  stream_epoch TEXT NOT NULL REFERENCES reporting_epochs(id) ON DELETE CASCADE,
  report_day TEXT NOT NULL CHECK(length(report_day)=10),
  revision INTEGER NOT NULL CHECK(revision>=1),
  active_ms INTEGER NOT NULL CHECK(active_ms BETWEEN 0 AND 86400000),
  practice_events INTEGER NOT NULL CHECK(practice_events BETWEEN 0 AND 10000),
  clean INTEGER NOT NULL CHECK(clean BETWEEN 0 AND practice_events),
  live_aim INTEGER NOT NULL CHECK(live_aim BETWEEN 0 AND practice_events),
  review_events INTEGER NOT NULL CHECK(review_events BETWEEN 0 AND practice_events),
  review_clean INTEGER NOT NULL CHECK(review_clean BETWEEN 0 AND review_events),
  review_live_aim INTEGER NOT NULL CHECK(review_live_aim BETWEEN 0 AND review_events),
  sessions_started INTEGER NOT NULL CHECK(sessions_started BETWEEN 0 AND 100),
  sessions_completed INTEGER NOT NULL CHECK(sessions_completed BETWEEN 0 AND sessions_started),
  sessions_abandoned INTEGER NOT NULL CHECK(sessions_abandoned BETWEEN 0 AND sessions_started),
  bonus_started INTEGER NOT NULL CHECK(bonus_started BETWEEN 0 AND 100),
  bonus_completed INTEGER NOT NULL CHECK(bonus_completed BETWEEN 0 AND bonus_started),
  modules_json TEXT NOT NULL CHECK(length(modules_json)<=8192),
  codes_json TEXT NOT NULL CHECK(length(codes_json)<=16384),
  payload_hash TEXT NOT NULL CHECK(length(payload_hash)=64),
  received_at INTEGER NOT NULL,
  PRIMARY KEY (learner_id,stream_epoch,report_day)
) STRICT;
CREATE INDEX daily_period ON daily_summaries(learner_id,report_day);

CREATE TABLE learner_state (
  learner_id TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  stream_epoch TEXT NOT NULL REFERENCES reporting_epochs(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK(revision>=1), synced_at INTEGER NOT NULL,
  cleared_json TEXT NOT NULL CHECK(length(cleared_json)<=8192),
  docs_count INTEGER NOT NULL CHECK(docs_count BETWEEN 0 AND 500),
  due_count INTEGER NOT NULL CHECK(due_count BETWEEN 0 AND 5000),
  profile_json TEXT NOT NULL CHECK(length(profile_json)<=16384),
  legacy_json TEXT NOT NULL DEFAULT '{}' CHECK(length(legacy_json)<=16384),
  incomplete_since INTEGER,
  payload_hash TEXT NOT NULL CHECK(length(payload_hash)=64)
) STRICT;

CREATE TABLE reports (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  period_start_day TEXT NOT NULL, period_end_day TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','sending','accepted','definitive_failure','unknown')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 20),
  lease_until INTEGER, generated_at INTEGER NOT NULL,
  received_cutoff INTEGER NOT NULL, data_cutoff INTEGER,
  template_version INTEGER NOT NULL,
  subject TEXT NOT NULL CHECK(length(subject)<=200),
  model_json TEXT NOT NULL CHECK(length(model_json)<=32768),
  text_body TEXT NOT NULL CHECK(length(text_body)<=65536),
  html_body TEXT NOT NULL CHECK(length(html_body)<=131072),
  message_stream TEXT NOT NULL CHECK(length(message_stream)<=100),
  recipient_hmac TEXT NOT NULL CHECK(length(recipient_hmac)=64),
  sender_hmac TEXT NOT NULL CHECK(length(sender_hmac)=64),
  request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
  provider_message_id TEXT
    CHECK(length(provider_message_id)<=128 OR provider_message_id IS NULL),
  accepted_at INTEGER,
  last_error_kind TEXT CHECK(length(last_error_kind)<=64 OR last_error_kind IS NULL),
  PRIMARY KEY (learner_id,period_start_day),
  CHECK(period_end_day>period_start_day)
) STRICT;
CREATE INDEX report_sweep ON reports(status,lease_until,attempts);

CREATE TABLE service_config (
  key TEXT PRIMARY KEY CHECK(key IN ('ingest_enabled','email_enabled')),
  value INTEGER NOT NULL CHECK(value IN (0,1)), updated_at INTEGER NOT NULL
) STRICT;
INSERT INTO service_config(key,value,updated_at) VALUES
  ('ingest_enabled',0,0),('email_enabled',0,0);
```

The migration also installs an `AFTER INSERT` enrollment trigger. It consumes
the matching code, revokes prior credentials, creates or retains the requested
epoch, closes the old epoch on replacement, marks the cutover day partial, and
updates `learners.active_epoch`. The Worker treats a guarded insert that changes
anything other than exactly one row as a generic enrollment failure. Tests prove
expired, replayed, and concurrent attempts leave every dependent table unchanged.

## API contract

Production accepts only exact `Origin` value `https://wordbreak.fun`; local
development uses one explicit configured localhost origin. Missing/`null`
origins fail. No CORS is emitted. Responses are
`Cache-Control:no-store`; errors are bounded generic codes; request bodies and
credentials are never logged.

- `POST /api/reporting/enroll`: JSON, ≤2 KiB; exchanges a valid enrollment code.
- `POST /api/reporting/sync`: JSON, ≤48 KiB; bearer device credential; one
  `schemaVersion:1` payload, ≤14 daily summaries, optional aggregate state,
  source revision, outbox depth, and optional drained coverage checkpoint.
- `POST /api/reporting/disconnect`: bearer device credential; revokes only it.

The enrollment fragment is parsed and scrubbed with `history.replaceState`
before any other initialization, DOM render, storage access, or logging. It is
cleared from memory after exchange and the clipboard after pairing. There is no
public admin/canary endpoint. A tracked operator CLI enqueues a synthetic frozen
canary through the real delivery path and invokes the scheduled handler.

The credential fixes learner and stream identity; client-supplied identity is
rejected. Day strings must parse and fall within the 60-day local retention
window plus five minutes of future skew. Enrollment errors are generic; codes
are unguessable and single use. Authenticated sync is limited to one accepted
request per device per second using `last_used_at`; excess receives 429. A 401
stops retries; terminal row rejection dead-letters only that day and leaves
gameplay untouched.

## Phases

### Phase 1 — Backend, schema, configuration, and contract tests

- [x] Preflight sibling `.env` key names only, Cloudflare identity, D1-create and
      secret permissions, current Worker/custom domains, and expected account. If
      insufficient, stop before mutation and mint a Wordbreak-scoped token.
- [x] Create the dedicated D1 database, write its returned ID into
      `wrangler.jsonc`, declare `main`, `ASSETS`, selective `/api/*` Worker-first
      routing, and the daily `0 16 * * *` Cron.
- [x] Add the migration, `src/worker.js`, and small modules for schema/auth,
      aggregate/report rendering, and Postmark delivery; keep each below 1,000 LOC.
- [x] Add `node:test` plus Wrangler/Miniflare local-D1 tests and a real
      `npm test` script. No hand-written D1 fake.
- [x] Fix `scripts/deploy.mjs` so explicit process credentials override env-file
      values and add pre-mutation identity assertions.
- [ ] Add a versioned progress export/import handoff, migrate Luca's actual
      origin into `wordbreak.fun`, fix the README URL, redirect alternatives where
      controllable, and disable Workers preview origins.

**Verification:** local migration apply and query; remote migration dry-run when
supported; contract tests for origins/auth/body bounds/enrollment races,
higher/stale/same-conflict daily revisions, one bad day among 14, partial drain,
checkpoint coverage, same-stream rotation, replacement epoch ownership/cutover,
disconnect, and asset/audio pass-
through; `npm test`; Wrangler dry-run bundle contains no secret material; 388
audio assets and inline JS parse remain green.

### Phase 2 — Atomic local summaries, session truth, time, and sync

- [x] Add the reporting ledger inside `P`, credential key outside it, migration
      from current rows, fixed-zone `reportDay`, zero-day heartbeat, dead letters,
      acknowledgement map, and 60-day retention.
- [ ] Implement the explicit session transition table and make terminal status,
      ended time, active time, daily aggregate, and current/history session revision
      part of the existing final-word/rollover atomic save.
- [ ] Implement the active-time sampler and test every arm/flush boundary.
- [x] Implement the serialized sync pump, per-row terminal rejection, drained
      checkpoint, and observer-only connected/stale/disconnected/incomplete state.
- [x] Keep the learner home/session UI byte-for-byte in hierarchy and primary
      actions; the one-time enrollment disclosure is the only learner-visible
      reporting surface.

**Verification:** browser fixtures for save failure/quota recovery, crashes after
every write/ack boundary, reload on the final-word screen, stale-day abandonment,
midnight-spanning attribution, multi-tab ownership, offline >60 days, 128 KiB
compaction/save failure, corrupt bucket, terminal poison day, empty-week heartbeat,
partial drain at Cron time, reset/re-pair stream epoch, device travel/DST,
foreground timeout/backoff, pagehide size, 401 stop, and zero credential/body
leakage. Full game and generated `public/index.html` smokes pass.

### Phase 3 — Frozen weekly report and safe delivery

- [x] Implement the metric dictionary, fresh/stale/gap/late-data coverage model,
      generic notification copy, and one shared escaped model for text/HTML.
- [x] Implement generate-most-recent-missing-period then sweep: Monday generation,
      Tuesday–Sunday recovery, 20-attempt parking, expired lease→unknown, and
      age-based cleanup independent of all switches.
- [x] Implement exact Postmark success/error classification, frozen bytes, HMAC
      address fingerprints, no-tracking/no-metadata envelope, manual suppression
      check, and operator-only
      unknown reconciliation/manual resend.
- [x] Add tracked preview and operator CLIs. Operator actions include create/
      rotate/revoke enrollment, configure/read switches, set secrets by stdin,
      enqueue/invoke canary, confirm mailbox receipt, reconcile/resend, inspect
      coverage, enforce retention, and delete.

**Verification:** golden text/HTML for normal, thin, proven-zero, stale, gap,
partial, late-data, legacy, and no-current-profile reports; DST/week fixtures;
crashes before fetch, during fetch, after response, and before D1 acceptance;
overlapping Cron leases; missed Monday; definitive daily retry; attempt parking;
retention while ingest/email disabled; sender/recipient fingerprint mismatch;
Postmark test-token acceptance with no secret/PII in logs or metadata.

### Phase 4 — Fail-closed production rollout and proof

- [x] Create D1, apply the forward-only migration, seed both switches disabled,
      dark-deploy, verify assets/API denial, then upload Wordbreak secrets. Pin
      the cleanup-capable prior Worker version as rollback target; never roll
      back schema.
- [ ] Enable ingest; create the learner/enrollment URL; copy it to the local
      clipboard without printing/persisting it; pair Luca's current browser after
      the disclosure; store the bounded legacy snapshot; verify prospective drained
      coverage and D1 totals.
- [ ] Record guardian authorization, enqueue one clearly labeled setup report
      to the fixed parent recipient, require provider MessageID, and record the
      parent's separate confirmation of inbox receipt.
- [ ] Enable email and verify the registered daily Cron and next weekly period.
- [x] Update README's now-false `no server` / `no network calls after load`
      statements with the precise local-first aggregate-reporting exception.
- [x] Re-run live HTML, API auth, SPA fallback, custom-domain, cache, manifest,
      and representative MP3 MIME/body verification.

**Verification:** live play succeeds with API unavailable; unpaired browser makes
zero API calls; unauthorized/wrong-origin API calls fail; production sync and
drained coverage succeed; D1 contains aggregates but no words; provider accepts
the canary; both D1 switches stop their paths without changing assets; production
HTML/runtime/audio gates pass.

## Hard requirements

- Reporting can never block or mutate learning behavior, scheduling, placement,
  audio, or navigation.
- No word, wrong spelling, free-form text, prompt, sentence, browser metadata,
  email address, or secret appears in synced learner payloads or logs.
- Missing/incomplete evidence is never rendered as zero performance or no play.
- One authoritative reporting device; re-pair starts an explicit stream epoch.
- Local reporting state commits in the same `wb2` save as its gameplay cause.
- Daily-summary writes are monotonic and report delivery bytes are immutable.
- An ambiguous Postmark transmission never auto-resends or claims acceptance.
- Cleanup remains active when collection/email are disabled.
- An unpaired browser makes no reporting call and sees no reporting UI.
- Static assets and audio preserve current URLs, MIME types, caching, and SPA
  behavior.

## Rollback / kill switches

- `ingest_enabled=0`: enrollment/sync return 404; game remains local-only.
- `email_enabled=0`: generation/send stop; cleanup and existing data remain.
- Emergency rollback order: disable email → disable ingest → revoke credential →
  roll back to the pinned cleanup-capable Worker only if necessary; schema stays
  forward-only. Keep the cleanup Cron until
  D1 is empty or retention has elapsed; if Cron must be removed, deploy explicit
  `triggers.crons: []` and run the operator cleanup on schedule.
- Browser disconnect removes its credential only after server acknowledgement;
  `wb2` progress is never deleted. D1 deletion requires the explicit operator
  delete command.
- Progress import always clears the separate reporting credential and requires
  explicit re-pairing, so imported state cannot sync under another learner's
  stream.

## Open questions

- Existing capped history cannot recover evicted activity or accurate historic
  active time. First enrollment labels the observed legacy window and starts
  precise measurement prospectively.
- Provider acceptance proves API handoff, not inbox placement. The first canary
  needs one human receipt confirmation.
- A full browser-storage reset destroys local progress and reporting state. New
  enrollment preserves server history but begins a new incomplete stream; it
  never pretends continuity.
