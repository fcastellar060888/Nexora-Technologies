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

Finding re-confirmed on the current baseline: `packedAvailableGrams()` and `receiveFinishedGoods()` still resolved production lots, consumed mass and classification globally by raw `lotId`. A foreign homonymous lot/receipt could therefore distort available packed mass, block a legitimate classification, or cause a receipt to target the wrong tenant.

Correction:
- resolve the packed production lot only inside the active organization;
- calculate consumed packed mass only from Finished Goods whose ownership resolves to that organization;
- fail closed for ownerless/ambiguous legacy Finished Goods participating in the same lot identity;
- scope classification uniqueness to the active tenant;
- reject caller-supplied organization/site context contradicting the resolved lot;
- materialize `organizationId`, `siteId` and canonical `lotId` on both Finished Good and movement;
- preserve tenant-local mass conservation.

Evidence: `tests/m4-2-postharvest-finished-goods-tenancy.test.js`, covering foreign homonyms, foreign-only lot, duplicate same-tenant lot identity, classification isolation, mass conservation and spoofed context.

Implementation commit: `093712a61d92c0bc944cee02c76b541c3739bf60`.
Adversarial evidence commit: `53c644d5148387e43996b71cd91b9ce45bf02c35`.

Status: **Ready for Quality — not Verified**.

## Remaining historical findings to re-audit

- F003 — Direct Postharvest UI ownership and legacy write paths.
- F004 — Canonical Postharvest authority, monotonic mass/quantity, terminality and durable replay.
- F005 — Lot detail / genealogy / timeline tenant-aware joins.

Each finding must be revalidated against the current baseline before any historical correction is ported.
