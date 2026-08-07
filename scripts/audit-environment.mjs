import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const policyPath = path.join(root, 'config', 'environments.json')
const envExamplePath = path.join(root, '.env.example')
const gitignorePath = path.join(root, '.gitignore')

function fail(message) {
  console.error(`Environment audit failed: ${message}`)
  process.exitCode = 1
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function parseEnvKeys(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => line.slice(0, line.indexOf('=')).trim())
}

if (!fs.existsSync(policyPath)) fail('missing config/environments.json')
if (!fs.existsSync(envExamplePath)) fail('missing .env.example')
if (!fs.existsSync(gitignorePath)) fail('missing .gitignore')

if (!process.exitCode) {
  const policy = readJson(policyPath)
  const expectedProfiles = ['local', 'preview', 'staging', 'production']
  for (const profile of expectedProfiles) {
    if (!policy.profiles?.[profile]) fail(`missing environment profile: ${profile}`)
  }

  const exampleKeys = parseEnvKeys(fs.readFileSync(envExamplePath, 'utf8'))
  const allowed = new Set(policy.allowedClientVariables || [])
  for (const key of exampleKeys) {
    if (!key.startsWith('VITE_')) fail(`browser template variable must use VITE_ prefix: ${key}`)
    if (!allowed.has(key)) fail(`unregistered client variable in .env.example: ${key}`)
    const upper = key.toUpperCase()
    for (const fragment of policy.forbiddenClientNameFragments || []) {
      if (upper.includes(fragment)) fail(`forbidden secret-like variable name exposed to browser: ${key}`)
    }
  }

  for (const [profile, config] of Object.entries(policy.profiles || {})) {
    for (const key of config.requiredPublicVariables || []) {
      if (!allowed.has(key)) fail(`${profile} requires unregistered public variable: ${key}`)
    }
  }

  const gitignore = fs.readFileSync(gitignorePath, 'utf8')
  for (const required of ['.env', '.env.*', '!.env.example', '!.env.*.example', 'dist/', 'node_modules/']) {
    if (!gitignore.includes(required)) fail(`.gitignore missing required rule: ${required}`)
  }

  const rootEntries = fs.readdirSync(root)
  const forbiddenCommittedEnv = rootEntries.filter((name) => {
    if (!name.startsWith('.env')) return false
    if (name === '.env.example' || name.endsWith('.example')) return false
    return fs.statSync(path.join(root, name)).isFile()
  })
  if (forbiddenCommittedEnv.length) fail(`environment-specific files present in repository root: ${forbiddenCommittedEnv.join(', ')}`)
}

if (!process.exitCode) {
  console.log('Environment audit: OK (local/preview/staging/production contract verified).')
}
