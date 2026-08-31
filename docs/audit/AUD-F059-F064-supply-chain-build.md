# AUD-F059–F064 — Supply chain, coverage, discovery and production build

Status: Ready for Quality
Verified: 0

## Reaudit

The current baseline materially remediates AUD-F059 through AUD-F064:

- F059: package-lock.json v3 exists and Quality installs with `npm ci`.
- F060: Quality runs `npm audit --audit-level=high`.
- F061: package manifests use exact versions and the lockfile fixes transitive resolution.
- F062: the test runner enforces coverage thresholds.
- F063: test discovery is recursive and fails closed when no tests are discovered.
- F064: Vite production build explicitly sets `sourcemap: false`.

## Regression evidence

`tests/aud-f059-f064-supply-chain-build.test.js` protects the remediated boundaries against regression.

## Certification rule

These findings are technically complete and remain Ready for Quality. They MUST NOT be marked Verified until GitHub Actions Quality runs on a real runner with executed steps and passes.

## Residual risk

Infrastructure-level Quality remains the certification authority. Static regression evidence does not substitute for a real Actions execution.
