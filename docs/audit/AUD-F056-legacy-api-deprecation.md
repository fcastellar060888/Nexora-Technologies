# AUD-F056 — Legacy API deprecation policy

## Status

Ready for Quality — not Verified.

## Historical finding

Legacy facades and APIs lacked an explicit deprecation policy, creating ambiguity about canonical authority, replacement paths, and safe retirement.

## Current-baseline re-audit

The current Knowledge Graph surface already contains the intended remediation:

- `src/core/knowledgeGraph/index.js` is the canonical public API and declares `authority: 'knowledge-graph-repository'`.
- The canonical API explicitly identifies `./legacy.js` as a compatibility facade.
- `src/core/knowledgeGraph/legacy.js` is explicitly marked `status: 'deprecated'`.
- The compatibility facade identifies the canonical replacement and a concrete removal criterion.
- Legacy object/node/relation helpers are not re-exported from the canonical index.

The historical defect is therefore no longer reproducible on the current implementation. The remaining gap found by re-audit was absence of regression evidence that locks this boundary.

## Remediation in this branch

Added `tests/aud-f056-legacy-api-deprecation.test.js` to fail if:

1. the compatibility facade stops being explicitly deprecated;
2. legacy and canonical authority diverge;
3. the canonical replacement or retirement criterion disappears;
4. the canonical Knowledge Graph API starts re-exporting legacy object/node/relation helpers as canonical surface; or
5. the compatibility facade is no longer declared by the canonical API.

## Certification rule

This finding is technically complete and may remain **Ready for Quality**. Do not mark it **Verified** without a GitHub Actions Quality run backed by a real runner with executed steps and passing evidence.
