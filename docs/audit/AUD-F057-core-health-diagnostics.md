# AUD-F057 — Core health in System Diagnostics

## Historical finding
System Diagnostics did not include Core health.

## Current-baseline re-audit
The historical implementation defect is no longer reproducible. `SystemDiagnosticsPage` consumes `getCoreHealthSnapshot`, combines Core checks with data diagnostics, and renders an explicit Core status KPI. The Core Health Registry fails visibly when no providers are registered and converts provider exceptions into critical diagnostic evidence.

## Regression evidence
`tests/aud-f057-core-health-diagnostics.test.js` locks the following boundaries:

- absence of Core health providers must not be reported as healthy;
- provider exceptions must surface as critical diagnostics;
- System Diagnostics must consume Core checks and expose Core status.

## Certification state
AUD-F057: Ready for Quality — 0 Verified.

Do not promote to Verified without a GitHub Actions Quality run backed by a real runner with executed steps.
