# Nexora One — Auditoría Forense v3 / M0 Foundation

## Baseline

- Architecture source of truth: `AH-001_Nexora_One_Architecture_Baseline_v1.0`
- Continuity source: `NX-CTX-001_Nexora_One_Project_Continuity_Brief`
- Repository: `fcastellar060888/Nexora-Technologies`
- Audited source branch: `foundation/event-bus-core`
- Audited source SHA: `7dcc0e30c7073b71dc8ebae0caafa2f9fb363545`
- Audit branch: `audit/v3-foundation-m0`
- Method: Audit → Fix → Test → Quality Gate → Re-Audit → Close

No historical finding is inherited as Closed without fresh verification against the current code and AH-001.

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
| AUD3-F001 | P0 | Operational Ledger / persistence | Canonical domain-event history is not durably persisted as an organization-wide server authority. Ledger entries are stored through `sync:false`, are absent from `SYNCABLE_COLLECTIONS`, and currently survive through device-local cache. The in-memory Ledger also assigns numeric sequence locally, so blindly syncing entries through generic `erp_records` would create cross-device sequence collisions. | Fixed |
| AUD3-F002 | P1 | Runtime / tenancy | Event Bus and Operational Ledger runtime identity is `organizationId::actorId`. The actor is event context, but currently also partitions infrastructure authority, creating separate buses/ledgers for users of the same organization and breaking workspace-wide live continuity. | Open |
| AUD3-F003 | P1 | Projection Engine | The public persistent Projection Engine defaults to an in-memory checkpoint store. Historical closure documentation explicitly leaves productive mounting blocked until a durable shared backend is injected. Production adoption is therefore not yet certifiable. | Open |
| AUD3-F004 | P1 | Git / release | `foundation/event-bus-core` is heavily diverged from `main` and PR #26 is not mergeable. At baseline it is 722 commits ahead and 4 behind `main`, making release review, rollback and integration unsafe until reconciled. | Open |
| AUD3-F005 | P2 | Deployment docs | Deployment documentation has drifted from the enforced pipeline: it instructs `npm install --no-audit` while CI uses lockfile-based `npm ci`; it also does not document the Supabase variables already declared mandatory by the environment contract. | Open |
| AUD3-F006 | P1 / verification | Quality Gate | The audited head `7dcc0e30...` has no observable combined status/checks through the connected GitHub status APIs at audit time. The current head cannot be treated as Quality-certified until an actual run is located or executed. | Open |
| AUD3-F007 | P0 | Offline cache / Ledger retention | `lightweightCache` applies a generic 1,500-record cap to every non-internal company collection while `operationalLedgerEntries` is designed to retain up to 10,000 entries. Ledger records expose `recordedAt`, but the generic cache ordering does not use it; once the cap is crossed, canonical local history can be silently truncated with incorrect recency ordering. | Fixed |
| AUD3-F008 | P0 | Remote bootstrap / Ledger | PostgreSQL bootstrap treats `operationalLedgerEntries` as a generic operational collection even though no matching generic `erp_records` authority exists, so authoritative hydration can replace the active Ledger partition with an empty collection. | Fixed |
| AUD3-F009 | P1 | Tenant isolation / cache | Segmented cache ownership resolution ignores `event.context.organizationId`. Ledger entries therefore look unowned and can be copied into every active-company cache instead of remaining in their organization partition. | Fixed |
| AUD3-F010 | P1 | Quality / test discovery | The recursive test runner only discovers `.test.mjs`, while the repository still contains active `.test.js` suites such as `remoteBootstrap.test.js`; those tests can silently fall outside Quality and coverage. | Fixed |

## AUD3-F001 evidence chain

- Product doctrine: meaningful actions produce immutable domain events and domain events are canonical records.
- `OperationalLedgerBridge`: Ledger-to-store persistence uses `sync:false`.
- `syncEngine`: `operationalLedgerEntries` is not a generic syncable collection.
- `lightweightCache`: non-internal arrays were retained only through device-local segmented cache.
- `memoryLedgerRepository`: sequence allocation starts locally at 1 per repository instance.
- Generic Supabase sync persists mutable records independently through `erp_records`; it cannot provide an organization-global append-only Ledger sequence.

### Implemented correction

- Dedicated `operational_ledger_events` PostgreSQL authority with organization/event primary identity.
- Dedicated organization counter and unique organization/sequence constraint.
- Server-side append RPC with membership validation, per-organization row lock and idempotency by immutable `eventId` content.
- RLS read policy and no direct authenticated insert/update/delete grants.
- Database trigger rejects updates and deletes.
- Client `operationalLedgerSync` uploads local entries after the last confirmed server cursor, then pulls canonical entries ordered by server sequence.
- Ledger synchronization runs before mutable `erp_records` synchronization; a Ledger failure prevents the mutable sync phase from starting.
- Retry after an uncertain network outcome is safe because the RPC returns the existing entry when the same `eventId` and content already exist.

### Remaining verification before closure

- Run adversarial multi-device tests.
- Run complete Quality Gate with `.test.js` and `.test.mjs` discovery.
- Re-audit database/client ordering, retry and tenant boundaries independently.

## AUD3-F007 evidence chain and correction

- `stateMigration` retains up to 10,000 `operationalLedgerEntries`.
- Old `lightweightCache` capped generic company collections at 1,500 records.
- Old cache ordering ignored Ledger `recordedAt` and nested `event.occurredAt`.
- Cache ownership now reads nested Ledger organization identity.
- Ledger cache now keeps a 10,000-entry confirmed window plus every entry whose local sequence is above the last server-confirmed Ledger cursor; unconfirmed events are never silently evicted.

## AUD3-F008 correction

`operationalLedgerEntries` and derived `timelineEntries` are excluded from generic PostgreSQL bootstrap. Ledger history now has a dedicated remote path instead of being overwritten by the `erp_records` hydration model.

## AUD3-F009 correction

Segmented cache ownership now includes `record.event.context.organizationId`; cross-organization Ledger entries are excluded from the active company snapshot.

## AUD3-F010 correction

The recursive test runner now discovers both `tests/**/*.test.mjs` and `tests/**/*.test.js`. Existing `.test.js` suites become natural sentinels proving that the extension is actually included.

## Counts

- Open: 5
- Fixing: 0
- Fixed: 5
- Verified: 0
- Closed: 0
