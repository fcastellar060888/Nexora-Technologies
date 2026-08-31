import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  AUTH_SESSION_KEY,
  LEGACY_AUTH_KEYS,
  createAuthSessionStorage,
} from '../src/services/authSessionStorage.js'

const root = process.cwd()
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed))
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

test('AUD-F065 codifies Cloudflare environments, promotion gates and immutable rollback', () => {
  const environments = readJson('config/environments.json')
  const deployment = readJson('config/deployment-policy.json')

  assert.equal(deployment.provider, 'cloudflare-pages')
  assert.equal(deployment.environmentContract, 'config/environments.json')

  for (const profile of ['preview', 'staging', 'production']) {
    assert.equal(
      deployment.environments[profile].deploymentProfile,
      environments.profiles[profile].deployment,
    )
    assert.equal(deployment.environments[profile].requiresSuccessfulQuality, true)
    assert.equal(deployment.environments[profile].buildScript, `build:${profile}`)
  }

  assert.equal(deployment.environments.production.requiresExplicitApproval, true)
  assert.equal(deployment.rollback.targetByImmutableDeploymentId, true)
  assert.equal(deployment.rollback.requiresTargetEnvironmentMatch, true)
  assert.equal(deployment.rollback.requiresPriorSuccessfulDeployment, true)
  assert.equal(deployment.rollback.requiresPostRollbackSmokeCheck, true)
  assert.equal(deployment.rollback.prohibitsSourceBranchRewrite, true)

  const requiredEvidence = new Set(deployment.requiredEvidence)
  for (const field of ['sourceCommitSha', 'qualityRunUrl', 'cloudflareDeploymentId', 'environment']) {
    assert.equal(requiredEvidence.has(field), true, `missing deployment evidence field ${field}`)
  }

  const rollbackEvidence = new Set(deployment.rollbackEvidence)
  for (const field of ['rollbackFromDeploymentId', 'rollbackToDeploymentId', 'postRollbackSmokeResult']) {
    assert.equal(rollbackEvidence.has(field), true, `missing rollback evidence field ${field}`)
  }

  const runbook = fs.readFileSync(path.join(root, 'docs/operations/CLOUDFLARE_DEPLOYMENT_RUNBOOK.md'), 'utf8')
  assert.match(runbook, /same project and same environment/i)
  assert.match(runbook, /deployment ID/i)
  assert.match(runbook, /Quality must have completed successfully/i)
  assert.match(runbook, /must not be implemented with `git reset --hard`/i)
})

test('AUD-F066 stores Supabase sessions in sessionStorage and scrubs legacy localStorage tokens', () => {
  const sessionStorageRef = memoryStorage()
  const localSeed = {
    [AUTH_SESSION_KEY]: 'stale-current-key-token',
    ...Object.fromEntries(LEGACY_AUTH_KEYS.map(key => [key, 'stale-legacy-token'])),
  }
  const localStorageRef = memoryStorage(localSeed)
  const auth = createAuthSessionStorage({
    sessionStorageRef,
    localStorageRef,
    broadcastChannelFactory: () => null,
  })

  const session = {
    access_token: 'access-token-must-not-reach-local-storage',
    refresh_token: 'refresh-token-must-not-reach-local-storage',
    user: { id: 'user-1' },
  }

  auth.save(session)

  assert.deepEqual(JSON.parse(sessionStorageRef.getItem(AUTH_SESSION_KEY)), session)
  assert.equal(localStorageRef.getItem(AUTH_SESSION_KEY), null)
  for (const key of LEGACY_AUTH_KEYS) assert.equal(localStorageRef.getItem(key), null)
  assert.deepEqual(auth.load(), session)

  auth.clear()
  assert.equal(sessionStorageRef.getItem(AUTH_SESSION_KEY), null)
  assert.equal(auth.load(), null)
})

test('AUD-F066 falls back to memory, never localStorage, when sessionStorage is unavailable', () => {
  const localStorageRef = memoryStorage()
  const unavailableSessionStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('blocked storage') },
    removeItem: () => {},
  }
  const auth = createAuthSessionStorage({
    sessionStorageRef: unavailableSessionStorage,
    localStorageRef,
    broadcastChannelFactory: () => null,
  })
  const session = { access_token: 'a', refresh_token: 'r', user: { id: 'u' } }

  auth.save(session)

  assert.deepEqual(auth.load(), session)
  assert.equal(localStorageRef.getItem(AUTH_SESSION_KEY), null)
  for (const key of LEGACY_AUTH_KEYS) assert.equal(localStorageRef.getItem(key), null)
})
