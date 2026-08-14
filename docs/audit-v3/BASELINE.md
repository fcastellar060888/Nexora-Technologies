# Nexora One — Auditoría Forense v3 / M0 Foundation

## Baseline

- Architecture source of truth: `AH-001_Nexora_One_Architecture_Baseline_v1.0`
- Continuity source: `NX-CTX-001_Nexora_One_Project_Continuity_Brief`
- Repository: `fcastellar060888/Nexora-Technologies`
- Audited source branch: `foundation/event-bus-core`
- Audited source SHA: `7dcc0e30c7073b71dc8ebae0caafa2f9fb363545`
- Audit branch: `audit/v3-foundation-m0`
- Method: Audit → Fix → Test → Quality Gate → Re-Audit → Close
- Closure code head: `a6c943e7d85b0109a836eeaa14fbb8b0de87ef5b`
- Closure Quality: workflow `Quality` run `#1477` (`31762778127`) — success
- Final documentation validation: workflow `Quality` run `#1481` (`31762937710`) — success

No historical finding was inherited as Closed. Every closure below was revalidated against the current implementation and the M0 acceptance method.

## M0 inventory

1. Build / dependency / CI gates
2. Domain Event contract and Event Bus
3. Operational Ledger
4. Projection Engine / replay / checkpoints
5. Persistence, offline cache and synchronization
6. Tenant/workspace isolation and runtime lifecycle
7. Authentication/session hardening
8. Environment and deployment controls
9. Error handling and operational observability
10. Git/release integration integrity

## Findings

| ID | Severity | Area | Finding | Status |
|---|---:|---|---|---|
| AUD3-F001 | P0 | Operational Ledger / persistence | Canonical domain-event history was not durably persisted as an organization-wide server authority. Ledger entries were device-local and local numeric sequence could collide across devices. | Closed |
| AUD3-F002 | P1 | Runtime / tenancy | Event Bus and Operational Ledger runtime identity used `organizationId::actorId`, partitioning infrastructure authority by user inside the same organization. | Closed |
| AUD3-F003 | P1 | Projection Engine | The public persistent Projection Engine silently defaulted to an in-memory checkpoint store, allowing a caller to believe persistence existed when it did not. | Closed |
| AUD3-F004 | P1 | Git / release | The long-lived foundation/audit line was behind `main`, leaving release ancestry diverged and integration unsafe. | Closed |
| AUD3-F005 | P2 | Deployment docs | Deployment documentation diverged from the certified pipeline and omitted mandatory Supabase environment variables. | Closed |
| AUD3-F006 | P1 / verification | Quality Gate | The baseline head had no observable Quality evidence and therefore could not be certified. | Closed |
| AUD3-F007 | P0 | Offline cache / Ledger retention | Generic cache retention could truncate Ledger history at 1,500 records and did not protect pending outbox entries. | Closed |
| AUD3-F008 | P0 | Remote bootstrap / Ledger | Generic PostgreSQL bootstrap could replace the active Ledger partition with an empty generic collection. | Closed |
| AUD3-F009 | P1 | Tenant isolation / cache | Segmented cache ownership ignored nested `event.context.organizationId`, allowing Ledger entries to appear unowned across company snapshots. | Closed |
| AUD3-F010 | P1 | Quality / test discovery | Recursive Quality discovery omitted active `.test.js` suites. | Closed |
| AUD3-F011 | P0 | Ledger outbox / concurrent sync | A shallow `syncMeta` commit could drop eventIds appended to the Ledger outbox while synchronization was in flight. | Closed |

## AUD3-F001 — durable Operational Ledger authority

### Correction

- Added dedicated PostgreSQL `operational_ledger_events` authority keyed by organization and immutable `eventId`.
- Added per-organization monotonic server sequence with a unique organization/sequence constraint.
- Added server append RPC with organization membership validation, row locking and idempotency by immutable event content.
- RLS allows member reads; authenticated clients cannot directly insert/update/delete Ledger rows.
- Database trigger rejects UPDATE and DELETE.
- Local appends enter explicit `syncMeta.ledgerOutboxByCompany`; remote reconciliation does not contaminate the outbox.
- Ledger synchronization uploads pending eventIds, then pulls canonical server sequence before mutable `erp_records` synchronization.
- Interrupted synchronization remains retry-safe by `eventId`.

### Re-audit

Adversarial multi-device, retry, remote/local sequence divergence, tenant validation and concurrent outbox tests are included in Quality. SQL/client ordering and immutability were independently re-read after the fix. No reopening condition was found.

## AUD3-F002 — organization-scoped runtime authority

### Correction

- `eventRuntimeKey()` now resolves runtime identity from `organizationId` only.
- `ledgerRuntimeKey()` now resolves runtime identity from `organizationId` only.
- `actorId` remains part of the immutable Domain Event context and remains queryable for attribution; it no longer creates separate Event Bus or Ledger infrastructure.
- Different organizations still resolve distinct runtime authorities.

### Re-audit

`tests/block-b-aud-f048-runtime-scope.test.mjs` proves that two actors in the same organization share Event Bus delivery and Ledger sequence while preserving each actor in `event.context.actorId`; a different organization remains isolated.

## AUD3-F003 — Projection Engine checkpoint authority

### Correction

- `createProjectionEngine()` remains the public persistent facade, but it no longer manufactures an implicit in-memory checkpoint store.
- The persistent facade now fails closed when `checkpointStore` is absent.
- `createVolatileProjectionEngine()` remains explicitly available for tests and diagnostics where durability is not part of the contract.
- Persistent idempotency tests continue to inject a shared/hydrated checkpoint store and verify restart, claim concurrency, retry and replay semantics.

### Re-audit

Core execution/timeout/observability/replay tests are explicit about volatile execution instead of accidentally relying on the public persistent facade. Quality therefore tests both contracts independently: volatile mechanics and persistent authority. Productive mounting cannot silently fall back to memory.

## AUD3-F004 — Git/release ancestry

### Correction

The four commits previously present only on `main` were compared individually against the audit branch. Their effective content — Nexora One README identity, Safari-safe split date/time controls, associated CSS, and production use in Infrastructure Operations — was already incorporated and superseded by the audited branch.

A no-content regression merge reconciled ancestry using the audited tree as authority and `main` as the second parent. No older implementation was reintroduced.

### Re-audit

Final comparison `main...audit/v3-foundation-m0` reports:

- status: `ahead`;
- behind: `0`;
- merge base: `main` head `58b0bf1a07aa5ef4e4988d7ff0472c7a2b8e7b8d`.

The branch is no longer topologically behind `main`.

## AUD3-F005 — deployment contract

### Correction

`docs/DEPLOYMENT.md` now matches the certified pipeline:

- lockfile installation with `npm ci --no-fund`;
- production build with `npm run build:production`;
- Node 24 parity with Quality CI;
- mandatory `VITE_APP_ENV`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for non-local environments;
- explicit prohibition on exposing privileged secrets as `VITE_*` variables;
- documented static, dependency, environment, auth, functional/coverage, production build and artifact gates;
- Supabase migrations, RLS and RPC treated as versioned production contract.

## AUD3-F006 — observable Quality certification

### Closure evidence

Quality run `#1477` executed against closure code head `a6c943e7d85b0109a836eeaa14fbb8b0de87ef5b` and completed successfully. Quality run `#1481` then validated the documentation state after the closure records were written. Every executable gate passed in both final validation stages:

- dependency installation from lockfile;
- Static audit;
- Dependency audit;
- Environment contract audit;
- Authentication and session audit;
- Functional tests;
- functional TAP evidence upload;
- Coverage gate;
- Production build;
- Production artifact audit.

No test, coverage threshold, dependency severity threshold or production audit was disabled to obtain the result.

## AUD3-F007 — Ledger cache retention

- Cache ownership reads nested Ledger organization identity.
- Ledger cache retains a 10,000-entry confirmed window plus every entry whose eventId remains in the explicit outbox.
- Pending entries are not inferred from local sequence and are never silently evicted by the generic 1,500-record cap.

## AUD3-F008 — remote bootstrap

`operationalLedgerEntries` and derived `timelineEntries` are excluded from generic PostgreSQL bootstrap. Ledger authority uses its dedicated remote synchronization path and cannot be replaced by an empty generic `erp_records` hydration result.

## AUD3-F009 — tenant isolation in segmented cache

Ownership resolution includes `record.event.context.organizationId`; cross-organization Ledger entries are excluded from the active company snapshot.

## AUD3-F010 — complete recursive test discovery

The test runner discovers both `tests/**/*.test.mjs` and `tests/**/*.test.js`. Existing `.test.js` suites participate in Functional and Coverage gates.

## AUD3-F011 — concurrent Ledger outbox commit

`commitIncrementalSyncResult()` merges outbox state as processed retained IDs plus IDs appended after the initial synchronization snapshot. Confirmed IDs can be removed without losing concurrently created IDs. Cursor maps are merged per company. A dedicated concurrency regression test covers confirmation of event A while event B is appended during the same synchronization window.

## Final independent re-audit

The closure pass re-read the critical authority boundaries rather than relying only on green tests:

- PostgreSQL Ledger sequence, membership, RLS, append idempotency and immutable mutation trigger;
- client Ledger tenant validation, append/pull order, cursor monotonicity and retry semantics;
- segmented cache retention and nested organization ownership;
- concurrent sync commit behavior;
- Event Bus and Ledger organization-scoped runtime identity with actor attribution retained in events;
- Projection Engine persistent/volatile API boundary;
- deployment/environment contract;
- Git ancestry against `main`;
- final Quality execution and production artifact audit.

No remaining M0 finding in this matrix met its reopening condition after Quality `#1477`; the subsequent documentation-state Quality `#1481` also completed successfully.

## Counts

- Open: 0
- Fixing: 0
- Fixed: 0
- Verified: 0
- Closed: 11
