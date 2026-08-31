# Cloudflare deployment and rollback runbook

This runbook is the operational authority for Nexora One deployments to Cloudflare Pages. The machine-readable contracts are `config/environments.json` and `config/deployment-policy.json`.

## Deployment gates

1. Deploy only a known source commit SHA.
2. The target profile must be one of `preview`, `staging`, or `production` and must match the corresponding `cloudflare-*` deployment profile in `config/environments.json`.
3. Quality must have completed successfully for the source commit before promotion. A workflow that never received a runner or executed steps is not deployment evidence.
4. Use the environment-specific build command: `npm run build:preview`, `npm run build:staging`, or `npm run build:production`.
5. Configure only the public browser variables registered by `config/environments.json`: `VITE_APP_ENV`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. Never expose service-role keys, database passwords, private keys, or other server secrets as `VITE_*` values.
6. Production promotion requires explicit human approval. Do not infer approval from a green build or from creation of a pull request.

## Evidence to retain

For each deployment record the source commit SHA, successful Quality run URL, Cloudflare deployment ID, environment, deployment timestamp, and operator. The Cloudflare deployment ID is the immutable operational reference for rollback; a branch name alone is insufficient evidence.

## Promotion sequence

Promote the same reviewed source lineage through preview, staging, and production. Re-run the target environment build rather than reusing an untracked local `dist/` directory. Verify the deployed environment corresponds to the intended profile before accepting the deployment.

For production, verify at minimum that the application shell loads, authentication reaches the expected Supabase project, a protected route enforces authorization, and System Diagnostics can be opened by an authorized operator. Record the result with the deployment evidence.

## Rollback procedure

Rollback restores a prior successful immutable Cloudflare Pages deployment for the **same project and same environment**. It is an operational deployment action, not a Git history rewrite.

1. Stop further promotion and identify the affected environment and current Cloudflare deployment ID.
2. Locate the last known-good successful Cloudflare Pages deployment for that same environment.
3. Confirm its deployment ID, source commit SHA, environment, and prior successful evidence before selecting it.
4. Use the Cloudflare Pages deployment control plane to restore/roll back to that exact prior deployment ID. Do not substitute a preview or staging deployment for production.
5. Run the post-rollback smoke check: application shell, authentication, protected-route authorization, and System Diagnostics.
6. Record `rollbackFromDeploymentId`, `rollbackToDeploymentId`, environment, operator, rollback timestamp, and smoke-check result.
7. Keep the incident or release record linked to both deployment IDs so the rollback remains auditable.

A rollback must **not** be implemented with `git reset --hard`, force-pushing `main`, rewriting branch history, or deploying an unrelated commit as an approximation of the previous release.

## Failure handling

If the target deployment ID cannot be proven to belong to the same environment, do not roll back to it. If the restored deployment fails the smoke check, keep the incident open and select another previously successful deployment using the same evidence requirements. Never weaken environment or authentication controls to make a rollback appear healthy.
