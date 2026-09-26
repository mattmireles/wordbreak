# Experiment infrastructure decision record

No real learner media may upload until every gate below is resolved in a new
immutable experiment config revision. The project, bucket, runtime identity,
and local operator credential were verified directly through Google Cloud APIs
on 2026-09-25. Upload remains disabled in the current observation-only
configuration because the upload pipeline has not yet been enabled.

| Decision | Current value | Gate |
| --- | --- | --- |
| Google Cloud project | `gist-is-backend` (`197678570363`) | Existing billing-enabled project; Wordbreak is isolated by bucket and service identity |
| Region | `us-central1` | Matches the project's existing Cloud Run estate and supports Cloud Run, Vertex AI, and regional GCS |
| Billing account | `012019-2499B9-40A19E`; active | The product owner explicitly waived the optional budget alert on 2026-09-25 |
| Private GCS bucket | `wordbreak-experiment-197678570363` | Public access prevention enforced; uniform bucket-level access; versioning; seven-day soft delete |
| Cloud Run service identity | `wordbreak-ingest@gist-is-backend.iam.gserviceaccount.com` | Keyless identity has `roles/storage.objectAdmin` only when the object name begins with `sessions/` in the experiment bucket |
| Vertex AI model/region | `UNRESOLVED` | Pinned after Phase 5 calibration |
| Retention date | Review on `2027-01-31`; explicit parent closeout controls deletion | Noncurrent versions delete after 30 days; live objects have a 365-day backstop |
| Budget alert | **Not configured; waived on 2026-09-25** | This is not an upload gate. Google Cloud budgets only warn; they do not cap spend |

The storage lifecycle is intentionally recoverable without becoming indefinite:

- current experiment objects remain available for explicit closeout and have a
  365-day deletion backstop;
- replaced generations delete after 30 days;
- deleted objects remain recoverable for seven days through GCS soft delete;
- no public ACL path exists because public access prevention and uniform
  bucket-level access are both enabled.

The current operator service account can create the required project resources
but has no billing-account permission. The Cloud Billing and Cloud Billing
Budget APIs are enabled; listing or creating a budget returns
`PERMISSION_DENIED`. The product owner explicitly chose to skip that optional
alert on 2026-09-25, so it is not a Phase 0 or upload gate.
`featureFlags.upload` remains `false` in the current observation-only
configuration. A later immutable configuration revision must enable it
explicitly; that flag is the experiment's immediate upload kill switch.

Local operator credentials use Application Default Credentials in the
operator's existing secure profile. They are never copied into the repository,
the iPhone bundle, logs, receipts, or agent homes. The phone receives only a
revocable random device credential provisioned by the parent. The service
stores its hash and returns short-lived, exact-object upload targets.

The bucket and Vertex AI project must be the same project for the first
implementation. A cross-project media path requires a separate physical dry
run and an amended decision record.
