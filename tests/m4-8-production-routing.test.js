import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const placeholder = fs.readFileSync(new URL('../src/pages/ProductionUnavailablePage.jsx', import.meta.url), 'utf8')

const productionRoutes = [
  '/production/harvest',
  '/production/drying',
  '/production/trimming',
  '/production/selection',
  '/production/packing',
  '/production/flow',
]

test('production routes never redirect into propagation', () => {
  for (const route of productionRoutes) {
    const line = app.split('\n').find((candidate) => candidate.includes(`path="${route}"`))
    assert.ok(line, `missing route ${route}`)
    assert.doesNotMatch(line, /Navigate/)
    assert.doesNotMatch(line, /propagation/)
    assert.match(line, /ProductionUnavailablePage/)
    assert.match(line, /permission="view_production"/)
  }
})

test('placeholder states that production is unavailable and does not mutate operational data', () => {
  assert.match(placeholder, /todavía no está habilitado/)
  assert.match(placeholder, /dominio operacional diferente/)
  assert.doesNotMatch(placeholder, /dispatch\s*\(/)
  assert.doesNotMatch(placeholder, /saveState\s*\(/)
  assert.doesNotMatch(placeholder, /authenticatedRequest\s*\(/)
})
