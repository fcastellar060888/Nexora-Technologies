# AUD-F049 / AUD-F050 — React runtime isolation and integration evidence

Status: **Ready for Quality / 0 Verified**

## Scope

This branch is stacked exactly on `3350420cfffae0dfa515c9fc49ab5fd12d0d7ff4` (AUD-F065/F066) and does not touch `main`.

- **AUD-F049**: historical finding stated that bridges, runtime and routes had no React Error Boundary.
- **AUD-F050**: historical finding stated that several React tests inspected source text instead of exercising real cycles.

## Reaudit

### AUD-F049

The production defect is no longer reproducible. `src/main.jsx` mounts `ApplicationErrorBoundary` above `BrowserRouter` and all application providers. `ApplicationErrorBoundary` isolates the failed tree behind an accessible `role="alert"` fallback and reports the caught error through an injectable reporter.

This branch adds executable regression evidence for state derivation, fallback isolation and reporting behavior.

### AUD-F050

A real gap remained in the forensic evidence: the audit suite did not demonstrate an actual React render cycle for the relevant UI boundary. This branch adds an integration test that loads the production component through Vite SSR, mounts it under `MemoryRouter`, and renders it with React DOM server. Assertions are made against the rendered output and route-derived behavior, not against source text.

The test intentionally uses the repository's existing React, React DOM, React Router and Vite dependencies; no dependency or lockfile change is required.

## Regression evidence

`tests/aud-f049-f050-react-runtime-integration.test.js` verifies:

1. the application boundary derives an isolated error state;
2. the fallback is rendered with `role="alert"` and does not render the healthy child after failure;
3. `componentDidCatch` forwards the real error and component stack to the reporter;
4. `ProductionUnavailablePage` is loaded through the production Vite transform path and exercised through a real React render cycle under `MemoryRouter`;
5. route-derived production-stage content and safe dashboard navigation are present in rendered output.

## Certification gate

These findings must remain **Ready for Quality / 0 Verified** until GitHub Actions Quality assigns a real runner and executes steps successfully. A workflow record with no runner or no executed steps is not certification evidence.
