CREATE TABLE canary_requests (
  learner_id TEXT PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  requested_at INTEGER NOT NULL,
  generated_at INTEGER,
  report_period TEXT UNIQUE
) STRICT;
