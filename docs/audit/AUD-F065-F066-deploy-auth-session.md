# AUD-F065 / AUD-F066 — Deployment and authentication session evidence

## Scope

This block reaudits the final deployment/security findings in the forensic remediation matrix without changing application business behavior.

### AUD-F065 — Cloudflare deployment, variables and rollback

Historical defect: Cloudflare deployment, environment variables and rollback were not sufficiently codified/documented.

Reaudit result:

- `config/environments.json` already defines local, preview, staging and production profiles and the browser-safe environment-variable allowlist.
- `scripts/audit-environment.mjs` already verifies the environment contract and rejects committed environment files and secret-like browser variable names.
- The historical `INSTALAR_Y_VER_CLOUDFLARE.md` was still stale: it named Cannapa ERP v6.1, instructed `npm install`, described a temporary development tunnel and contained no promotion or rollback control.

Remediation in this branch:

- Added `config/deployment-policy.json` as the machine-readable Cloudflare Pages deployment/rollback policy.
- Added `docs/operations/CLOUDFLARE_DEPLOYMENT_RUNBOOK.md` as the canonical operational runbook.
- Retired the stale tunnel instructions in `INSTALAR_Y_VER_CLOUDFLARE.md` in favor of the canonical policy/runbook.
- Added regression evidence that binds deployment profiles to `config/environments.json`, requires successful Quality before promotion, requires explicit production approval and constrains rollback to a prior successful immutable deployment ID for the same environment.

### AUD-F066 — Supabase auth tokens in localStorage

Historical defect: persistent Supabase auth tokens in `localStorage` increased XSS exposure.

Reaudit result:

- `src/services/supabase.js` delegates session persistence to `createAuthSessionStorage()` and uses refresh single-flight.
- `src/services/authSessionStorage.js` persists sessions in `sessionStorage`, actively removes current and legacy auth keys from `localStorage`, propagates logout across tabs and intentionally falls back to memory when sessionStorage is unavailable.
- `scripts/audit-auth-session.mjs` recursively rejects auth/session token writes to `localStorage`, token-bearing console logging and loss of the hardened storage invariants.

Regression evidence added here executes the storage boundary directly with injected storage implementations. It proves tokens are written to sessionStorage, stale localStorage auth keys are scrubbed, clear removes the session, and storage failure degrades to memory rather than localStorage.

## Certification state

- AUD-F065: **Ready for Quality / 0 Verified**.
- AUD-F066: **Ready for Quality / 0 Verified**.
- Promotion to Verified requires a GitHub Actions Quality run on the final branch HEAD with a real runner and executed steps.
- A workflow failure with `runner_id: 0`, no runner name or no executed steps is infrastructure evidence only and cannot certify either finding.

## Residual risk

Repository evidence cannot prove the external Cloudflare account is configured exactly as documented or that a production rollback has been rehearsed against a real deployment. Those are operational certification activities. The repository now prevents the previous ambiguity from being treated as an approved deployment procedure.

M3.2 MIPE is outside this block and remains untouched.
