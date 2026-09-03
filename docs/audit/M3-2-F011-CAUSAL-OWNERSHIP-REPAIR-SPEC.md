# M3.2 F011 — causal ownership repair specification

Status: remediation in progress; **not Verified**.

## Defect reproduced during certification

`mipeRecordOrganizationId()` currently couples tenant ownership resolution with `recordSiteCausallyValid()`. For `mipeInterventions`, that causal validator rejects a Treatment-type Intervention when `treatmentId` is absent, when the referenced Treatment cannot be resolved inside the tenant, or when the Treatment belongs to another Finding. `mipeRecordsForOrganization()` then removes that record before `projectMipePassportTrace()` can execute its explicit fail-closed causal checks.

This means corrupt same-tenant causal evidence can disappear from the Passport instead of making the projection fail closed.

## Required invariant

Ownership answers **which tenant owns the record**. Causal validation answers **whether an owned record is admissible evidence**. A causal defect must never erase an explicitly same-tenant record from the evidence set before the projector validates it.

At the same time, a genuinely foreign homonym must remain isolated and must not be allowed to cause a denial of service in the active tenant.

## Minimal production repair

1. Preserve the current strict ownership-group conflict checks.
2. For `mipeInterventions` with an explicit `organizationId`, do not use missing/invalid Treatment causality as a reason to erase otherwise unambiguous same-tenant ownership.
3. Continue rejecting explicit ownership when a positive ownership signal (Finding, Treatment or Site) proves the record belongs to another tenant.
4. Let `projectMipePassportTrace()` receive same-tenant Interventions and enforce its existing causal checks:
   - Treatment-type Intervention without canonical `treatmentId` => throw.
   - `treatmentId` that is not present in the active tenant causal set => throw.
   - Treatment whose `findingId` differs from the Intervention Finding => throw.
5. Keep command/mutation boundaries strict: `ownMipeRecord()` must continue rejecting invalid causal writes. This repair is about forensic projection of already-persisted/corrupt evidence, not weakening write validation.

## Mandatory regression matrix

The certification regression `tests/m3-2-mipe-certification-f011-failclosed-boundary.test.mjs` defines the required boundary:

- explicit same-tenant Treatment Intervention without `treatmentId` must reach the projector and fail closed;
- a foreign-tenant Treatment homonym must not satisfy the active tenant Intervention;
- a genuinely foreign Intervention homonym must remain isolated and must not fail the active tenant projection;
- a valid non-Treatment (`Seguimiento`) Intervention remains legal without a Treatment.

## Certification gate

F011 remains **Ready for Quality / 0 Verified** until the production repair is committed and a GitHub Actions Quality run on the exact repaired HEAD uses a real runner, executes steps, and produces reviewable `functional-test-evidence`. F010 and F012 must not be promoted ahead of that gate.
