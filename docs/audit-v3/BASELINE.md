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
| AUD3-F001 | P0 | Operational Ledger / persistence | Canonical domain-event history is not durably persisted as an organization-wide server authority. Ledger entries are stored through `sync:false`, are absent from `SYNCABLE_COLLECTIONS`, and currently survive through device-local cache. The in-memory Ledger also assigns numeric sequence locally, so blindly syncing entries through generic `erp_records` would create cross-device sequence collisions. | Fixing |
| AUD3-F002 | P1 | Runtime / tenancy | Event Bus and Operational Ledger runtime identity is `organizationId::actorId`. The actor is event context, but currently also partitions infrastructure authority, creating separate buses/ledgers for users of the same organization and breaking workspace-wide live continuity. | Open |
| AUD3-F003 | P1 | Projection Engine | The public persistent Projection Engine defaults to an in-memory checkpoint store. Historical closure documentation explicitly leaves productive mounting blocked until a durable shared backend is injected. Production adoption is therefore not yet certifiable. | Open |
| AUD3-F004 | P1 | Git / release | `foundation/event-bus-core` is heavily diverged from `main` and PR #26 is not mergeable. At baseline it is 722 commits ahead and 4 behind `main`, making release review, rollback and integration unsafe until reconciled. | Open |
| AUD3-F005 | P2 | Deployment docs | Deployment documentation has drifted from the enforced pipeline: it instructs `npm install --no-audit` while CI uses lockfile-based `npm ci`; it also does not document the Supabase variables already declared mandatory by the environment contract. | Open |
| AUD3-F006 | P1 / verification | Quality Gate | The audited head `7dcc0e30...` has no observable combined status/checks through the connected GitHub status APIs at audit time. The current head cannot be treated as Quality-certified until an actual run is located or executed. | Open |
| AUD3-F007 | P0 | Offline cache / Ledger retention | `lightweightCache` applies a generic 1,500-record cap to every non-internal company collection while `operationalLedgerEntries` is designed to retain up to 10,000 entries. Ledger records expose `recordedAt`, but the generic cache ordering does not use it; once the cap is crossed, canonical local history can be silently truncated with incorrect recency ordering. | Fixing |

## AUD3-F001 evidence chain

- Product doctrine: meaningful actions produce immutable domain events and domain events are canonical records.
- `OperationalLedgerBridge`: Ledger-to-store persistence uses `sync:false`.
- `syncEngine`: `operationalLedgerEntries` is not a syncable collection.
- `lightweightCache`: non-internal arrays are retained in browser-local segmented cache.
- `memoryLedgerRepository`: sequence allocation starts locally at 1 per repository instance.
- Generic Supabase sync persists records independently through `erp_records`; it does not provide an organization-global Ledger sequence.

### Closure condition

AUD3-F001 requires a durable, organization-scoped, append-only server authority with:

- server-assigned monotonic sequence;
- idempotency by `eventId`;
- immutable event payload after append;
- organization membership enforcement / RLS-compatible access;
- ordered incremental reads;
- offline append queue with safe retry;
- rehydration/reconciliation into the local Ledger without sequence rewriting or collisions;
- adversarial multi-device tests;
- full Quality Gate and independent re-audit.

## AUD3-F007 evidence chain

- `stateMigration` normalizes and retains up to 10,000 `operationalLedgerEntries`.
- `lightweightCache` caps generic company collections at 1,500 records.
- `operationalLedgerEntries` is not excluded from that generic company-cache path.
- The generic `stamp()` function ignores Ledger `recordedAt` and nested `event.occurredAt`.

### Closure condition

Ledger persistence must have an explicit retention policy that never silently discards newer canonical history. Pending/unconfirmed events must never be dropped. If local retained history is intentionally bounded, the server Ledger must remain authoritative and the UI/runtime must expose that the local view is a cache window rather than the System of Record.

## Counts

- Open: 5
- Fixing: 2
- Fixed: 0
- Verified: 0
- Closed: 0
