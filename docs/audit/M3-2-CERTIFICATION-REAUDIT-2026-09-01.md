# M3.2 MIPE — certification re-audit after GitHub Actions runner recovery

Date: 2026-09-01 UTC

## Candidate under test

- Frozen certification candidate: `audit/v3-m3-2-mipe`
- Candidate SHA: `0895f6ed410e042dbc081e450c11d024e81b4cb5`
- Existing PR: #46
- Historical Quality run: #2507 (`run_id=32844400625`), originally failed before runner assignment.

The failed jobs of Quality #2507 were re-run after GitHub Actions demonstrated runner recovery on AUD-F055. The re-run used the exact frozen SHA above; no M3.2 source change preceded the certification attempt.

## Real-run result

The re-run received a real GitHub-hosted runner and executed steps. The following gates completed successfully before functional execution:

- Set up job
- Checkout
- Setup Node
- Install dependencies from lockfile
- Static audit
- Dependency audit
- Environment contract audit
- Authentication and session audit

`Functional tests` executed and failed. Therefore F010, F011 and F012 MUST NOT be promoted to Verified.

The run uploaded `functional-test-evidence` despite the failure:

- artifact id: `9783138753`
- size: `53471` bytes
- digest: `sha256:a5922742de8d7c6abb6db9a94af0bb78a4ed7a0a5f21c81286a625ccbb01cd80`
- head SHA: `0895f6ed410e042dbc081e450c11d024e81b4cb5`

The TAP evidence contains 17 unique failing tests (the textual `failing tests` recap duplicates their names).

## Re-audit classification

The failure set is mixed. Several tests are source-shape/string expectations that no longer match later hardening/refactors and must not be used to force production back to older implementation shapes. Examples include permission expressions, propagation source invocation shape, Dashboard wording and unified-map implementation details.

At least one failure, however, exposes a real F011 causal-integrity defect rather than test drift:

1. `F011 causality: una Intervention de Tratamiento requiere Treatment canónico`
2. `F011 causality: Treatment homónimo de otro tenant no satisface una Intervention`

`projectMipePassportTrace()` contains explicit fail-closed checks for both conditions, but obtains `allInterventions` through `mipeRecordsForOrganization()` first. `mipeRecordOrganizationId()` rejects a causally-invalid same-tenant Intervention by returning an empty owner. The projection therefore filters that record out before its explicit causal checks execute. The result is fail-silent omission of corrupt same-tenant causal evidence from the Knowledge Graph instead of fail-closed rejection.

This is a real certification defect because malformed evidence can disappear from a Passport projection rather than make the projection reject an inconsistent causal chain.

## Required remediation boundary

Remediation must preserve tenant isolation while making explicitly same-tenant MIPE evidence that references the projected Finding fail closed before it can be silently filtered. Foreign-tenant homonyms must remain ignored/isolated rather than causing cross-tenant denial of service.

The repair must prove at minimum:

- a same-tenant `Tratamiento` Intervention without canonical `treatmentId` throws;
- a same-tenant Intervention whose `treatmentId` resolves only to another tenant throws;
- a legitimate foreign-tenant homonym remains isolated and does not poison the active tenant projection;
- valid Seguimiento without Treatment remains allowed;
- existing F011 snapshot and historical-Incident causality remains intact.

The two existing failing F011 causality tests already provide red evidence for the first two requirements and should be retained.

## Other failures

The remaining failures require individual re-audit before code changes. They include legacy Passport cardinality/status expectations, propagation tests, tenancy inference expectations, material-plant MIPE/Passport expectations, Dashboard source-shape assertions and unified-map source-shape assertions. No production behavior should be changed solely to satisfy stale regex/cardinality expectations.

## Certification state

- M3.2 is no longer treated as a clean frozen certification candidate because a real F011 defect was reproduced on a real runner.
- F010: not Verified.
- F011: not Verified; real causal-integrity remediation required.
- F012: not Verified.
- Sequential closure F010 -> F011 -> F012 is stopped until the repaired candidate has a green Quality run on a real runner and `functional-test-evidence` is reviewed.
- `main` is untouched and no merge is authorized.
