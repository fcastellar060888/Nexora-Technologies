import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('AUD-F059/F061: dependency installation is reproducible', () => {
  const pkg = JSON.parse(read('package.json'))
  const lock = JSON.parse(read('package-lock.json'))
  assert.equal(lock.lockfileVersion, 3)
  assert.equal(lock.packages[''].name, pkg.name)
  for (const section of ['dependencies', 'devDependencies']) {
    for (const version of Object.values(pkg[section] ?? {})) {
      assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, `${section} must use exact versions`)
    }
  }
})

test('AUD-F060/F062/F063: Quality enforces audit, recursive tests and coverage', () => {
  const quality = read('.github/workflows/quality.yml')
  const runner = read('scripts/run-tests.mjs')
  assert.match(quality, /npm ci/)
  assert.match(quality, /npm audit --audit-level=high/)
  assert.match(quality, /npm run test:coverage/)
  assert.match(runner, /recursive/i)
  assert.match(runner, /coverage/i)
})

test('AUD-F064: production source maps remain disabled', () => {
  const vite = read('vite.config.js')
  assert.match(vite, /sourcemap:\s*false/)
})
