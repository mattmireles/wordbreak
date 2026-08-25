CREATE TABLE learners (
  id TEXT PRIMARY KEY CHECK(length(id) = 36),
  active_epoch TEXT NOT NULL CHECK(length(active_epoch) = 36),
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
  gaps_json TEXT NOT NULL DEFAULT '[]' CHECK(length(gaps_json) <= 8192)
) STRICT;

CREATE TABLE reporting_epochs (
  id TEXT PRIMARY KEY CHECK(length(id) = 36),
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  start_day TEXT NOT NULL CHECK(length(start_day) = 10),
  ended_at INTEGER,
  end_day TEXT,
  cutover_partial INTEGER NOT NULL DEFAULT 0 CHECK(cutover_partial IN (0, 1)),
  max_accepted_revision INTEGER NOT NULL DEFAULT 0 CHECK(max_accepted_revision >= 0),
  max_drained_revision INTEGER NOT NULL DEFAULT 0 CHECK(max_drained_revision >= 0),
  earliest_complete_day TEXT,
  complete_through_day TEXT,
  gaps_json TEXT NOT NULL DEFAULT '[]' CHECK(length(gaps_json) <= 8192)
) STRICT;
CREATE INDEX epoch_learner ON reporting_epochs(learner_id, started_at);

CREATE TABLE enrollment_codes (
  code_hash TEXT PRIMARY KEY CHECK(length(code_hash) = 64),
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  requested_epoch TEXT NOT NULL REFERENCES reporting_epochs(id) ON DELETE CASCADE,
  same_stream INTEGER NOT NULL CHECK(same_stream IN (0, 1)),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
) STRICT;
CREATE INDEX enrollment_expiry ON enrollment_codes(expires_at, used_at);

CREATE TABLE device_credentials (
  id TEXT PRIMARY KEY CHECK(length(id) = 36),
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  stream_epoch TEXT NOT NULL REFERENCES reporting_epochs(id) ON DELETE CASCADE,
  enrollment_code_hash TEXT NOT NULL UNIQUE CHECK(length(enrollment_code_hash) = 64),
  token_hash TEXT NOT NULL UNIQUE CHECK(length(token_hash) = 64),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
) STRICT;
CREATE INDEX device_learner ON device_credentials(learner_id, revoked_at);

CREATE TRIGGER consume_enrollment AFTER INSERT ON device_credentials
BEGIN
  UPDATE enrollment_codes
  SET used_at = NEW.created_at
  WHERE code_hash = NEW.enrollment_code_hash AND used_at IS NULL;

  UPDATE device_credentials
  SET revoked_at = NEW.created_at
  WHERE learner_id = NEW.learner_id AND id <> NEW.id AND revoked_at IS NULL;

  UPDATE reporting_epochs
  SET ended_at = NEW.created_at,
      end_day = (SELECT start_day FROM reporting_epochs WHERE id = NEW.stream_epoch),
      cutover_partial = 1
  WHERE learner_id = NEW.learner_id
    AND id <> NEW.stream_epoch
    AND ended_at IS NULL;

  UPDATE learners
  SET active_epoch = NEW.stream_epoch,
      reporting_started_at = COALESCE(reporting_started_at, NEW.created_at)
  WHERE id = NEW.learner_id;
END;

CREATE TABLE daily_summaries (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  stream_epoch TEXT NOT NULL REFERENCES reporting_epochs(id) ON DELETE CASCADE,
  report_day TEXT NOT NULL CHECK(length(report_day) = 10),
  revision INTEGER NOT NULL CHECK(revision >= 1),
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
  modules_json TEXT NOT NULL CHECK(length(modules_json) <= 8192),
  codes_json TEXT NOT NULL CHECK(length(codes_json) <= 16384),
  payload_hash TEXT NOT NULL CHECK(length(payload_hash) = 64),
  received_at INTEGER NOT NULL,
  PRIMARY KEY (learner_id, stream_epoch, report_day)
) STRICT;
CREATE INDEX daily_period ON daily_summaries(learner_id, report_day);

CREATE TABLE learner_state (
  learner_id TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  stream_epoch TEXT NOT NULL REFERENCES reporting_epochs(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK(revision >= 1),
  synced_at INTEGER NOT NULL,
  cleared_json TEXT NOT NULL CHECK(length(cleared_json) <= 8192),
  docs_count INTEGER NOT NULL CHECK(docs_count BETWEEN 0 AND 500),
  due_count INTEGER NOT NULL CHECK(due_count BETWEEN 0 AND 5000),
  profile_json TEXT NOT NULL CHECK(length(profile_json) <= 16384),
  legacy_json TEXT NOT NULL DEFAULT '{}' CHECK(length(legacy_json) <= 16384),
  incomplete_since INTEGER,
  payload_hash TEXT NOT NULL CHECK(length(payload_hash) = 64)
) STRICT;

CREATE TABLE reports (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  period_start_day TEXT NOT NULL,
  period_end_day TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'sending', 'accepted', 'definitive_failure', 'unknown')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 20),
  lease_until INTEGER,
  generated_at INTEGER NOT NULL,
  received_cutoff INTEGER NOT NULL,
  data_cutoff INTEGER,
  template_version INTEGER NOT NULL,
  subject TEXT NOT NULL CHECK(length(subject) <= 200),
  model_json TEXT NOT NULL CHECK(length(model_json) <= 32768),
  text_body TEXT NOT NULL CHECK(length(text_body) <= 65536),
  html_body TEXT NOT NULL CHECK(length(html_body) <= 131072),
  message_stream TEXT NOT NULL CHECK(length(message_stream) <= 100),
  recipient_hmac TEXT NOT NULL CHECK(length(recipient_hmac) = 64),
  sender_hmac TEXT NOT NULL CHECK(length(sender_hmac) = 64),
  request_hash TEXT NOT NULL CHECK(length(request_hash) = 64),
  provider_message_id TEXT CHECK(length(provider_message_id) <= 128 OR provider_message_id IS NULL),
  accepted_at INTEGER,
  last_error_kind TEXT CHECK(length(last_error_kind) <= 64 OR last_error_kind IS NULL),
  PRIMARY KEY (learner_id, period_start_day),
  CHECK(period_end_day > period_start_day)
) STRICT;
CREATE INDEX report_sweep ON reports(status, lease_until, attempts);

CREATE TABLE service_config (
  key TEXT PRIMARY KEY CHECK(key IN ('ingest_enabled', 'email_enabled')),
  value INTEGER NOT NULL CHECK(value IN (0, 1)),
  updated_at INTEGER NOT NULL
) STRICT;
INSERT INTO service_config(key, value, updated_at) VALUES
  ('ingest_enabled', 0, 0),
  ('email_enabled', 0, 0);
