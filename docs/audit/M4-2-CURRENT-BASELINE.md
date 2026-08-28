# M4.2 — Postharvest / Production Flow — Current Baseline

Base: `audit/v3-m3-3-f012-passport-adversarial` @ `bd744badb596fd0506679b677a2af7a255b2f7f4`.

Branch: `audit/v3-m4-2-postharvest-current`.

This branch re-audits Postharvest on top of the current M3.3 hardening instead of reusing the historically divergent M4.2 branch.

## Certification boundary

M3.2 MIPE remains frozen as certification candidate. No F010/F011/F012 finding may be promoted to Verified without a GitHub Actions Quality run with a real runner, executed steps, and valid `functional-test-evidence`.

This branch does not modify `main` and is not authorized for merge.

## F001 — Critical — Ready for Quality

Finding: `advanceProductionLot()` resolved `propagationBatches` by raw `lotId` and updated every matching raw ID. Homonymous lot identities across organizations therefore allowed a phase transition requested under the active tenant to mutate another tenant's lot.

Current-base evidence confirmed the defect was present again in `src/domain/production.js`.

Correction:
- resolve the active organization before lot selection;
- resolve lot ownership through `resolveOrganizationId()` including site/organization contradiction checks;
- reject foreign, ownerless/ambiguous, and duplicate same-tenant lot identities;
- update only the resolved array position instead of every row sharing the raw ID;
- stamp the resulting `lotEvent` with `organizationId` and `siteId`;
- reject caller-supplied organization/site context that contradicts the resolved lot.

Evidence:
- `tests/m4-2-postharvest-tenancy.test.js`
- homonymous cross-tenant lot mutation isolation;
- foreign-only lot rejection;
- duplicate same-tenant lot identity rejection;
- explicit organization/site contradiction rejection.

Implementation commit: `1be1453770476d1de991a897295a3ed1359da642`.
Adversarial evidence commit: `01f1a16edc03a4ccf24702565feb3fc330fb7cbc`.

Status: **Ready for Quality — not Verified**.

## Remaining historical findings to re-audit

- F002 — Finished Goods mass/classification tenancy.
- F003 — Direct Postharvest UI ownership and legacy write paths.
- F004 — Canonical Postharvest authority, monotonic mass/quantity, terminality and durable replay.
- F005 — Lot detail / genealogy / timeline tenant-aware joins.

Each finding must be revalidated against the current baseline before any historical correction is ported.
