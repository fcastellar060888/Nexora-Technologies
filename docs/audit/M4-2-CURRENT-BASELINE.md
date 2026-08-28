# M4.2 — Postharvest / Production Flow — Current Baseline

Base: `audit/v3-m3-3-f012-passport-adversarial` @ `bd744badb596fd0506679b677a2af7a255b2f7f4`.

Branch: `audit/v3-m4-2-postharvest-current`.

This branch re-audits Postharvest on top of the current M3.3 hardening instead of reusing the historically divergent M4.2 branch.

## Certification boundary

M3.2 MIPE remains frozen as certification candidate. No F010/F011/F012 finding may be promoted to Verified without a GitHub Actions Quality run with a real runner, executed steps, and valid `functional-test-evidence`.

This branch does not modify `main` and is not authorized for merge.

## F001 — Critical — Ready for Quality

Finding: `advanceProductionLot()` resolved `propagationBatches` by raw `lotId` and updated every matching raw ID. Homonymous lot identities across organizations therefore allowed a phase transition requested under the active tenant to mutate another tenant's lot.

Correction: active-tenant resolution via `resolveOrganizationId()`, fail-closed foreign/ambiguous/duplicate identity handling, single-index mutation, and explicit tenant/site event stamps.

Evidence: `tests/m4-2-postharvest-tenancy.test.js`.

Status: **Ready for Quality — not Verified**.

## F002 — High — Ready for Quality

Finding re-confirmed on the current baseline: `packedAvailableGrams()` and `receiveFinishedGoods()` still resolved production lots, consumed mass and classification globally by raw `lotId`.

Correction: tenant-scoped lot/Finished Goods resolution, fail-closed ambiguous ownership, tenant-local classification uniqueness and mass conservation, explicit organization/site stamps.

Evidence: `tests/m4-2-postharvest-finished-goods-tenancy.test.js`.

Status: **Ready for Quality — not Verified**.

## F003 — High — Ready for Quality

Finding re-confirmed: direct stage pages wrote legacy arrays and read global collections. They now route through `CanonicalPostharvestStage`; legacy arrays and `productionFlows` are read-only domain APIs.

Evidence: `tests/m4-2-postharvest-ui-tenancy.test.js`.

Status: **Ready for Quality — not Verified**.

## F004 — Critical — Ready for Quality

Re-audit found one remaining second operational authority: `ProductionFlowPage` still created and advanced `productionFlows` directly even though the stage pages and domain legacy APIs had already been closed. That UI could bypass canonical tenancy, monotonic quantity/mass, terminality and replay controls.

Correction:
- `ProductionFlowPage` now projects active-tenant `propagationBatches` and advances exclusively through `advanceProductionLot()`;
- no operational UI writes `productionFlows`;
- `activeQuantity` cannot increase during transition;
- `Finalizado` remains terminal;
- `eventId + commandSignature` provide stable replay and contradictory reuse rejection;
- every weighted stage consumes the causal predecessor's output and cannot increase mass;
- legacy `advanceProductionFlow()` remains fail-closed.

Evidence: `tests/m4-2-postharvest-canonical-flow.test.js`.

Implementation commit: `69ef3b1401fab0fff1704560ee9892d4756103f5`.
Adversarial evidence commit: `53627745dfc955fe3990f695942a228f9459e7e1`.

Status: **Ready for Quality — not Verified**.

## Remaining historical finding to re-audit

- F005 — Lot detail / genealogy / timeline tenant-aware joins.

F001–F004 are technically complete but require Quality before any certification status can be claimed.
