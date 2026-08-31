import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')

const productionRoutes = [
  '/production/harvest',
  '/production/drying',
  '/production/trimming',
  '/production/selection',
  '/production/packing',
  '/production/flow',
]

test('AUD-F055 production routes use the explicit unavailable surface', () => {
  assert.match(appSource, /import ProductionUnavailablePage from '\.\/pages\/ProductionUnavailablePage'/)

  for (const route of productionRoutes) {
    const escaped = route.replaceAll('/', '\\/')
    assert.match(
      appSource,
      new RegExp(`path="${escaped}"[^\n]*<ProductionUnavailablePage \\/>`),
      `${route} must remain an explicit production placeholder`,
    )
  }
})

test('AUD-F055 production routes never alias propagation domain routes', () => {
  for (const route of productionRoutes) {
    const routeIndex = appSource.indexOf(`path="${route}"`)
    assert.notEqual(routeIndex, -1, `${route} must exist`)
    const routeLine = appSource.slice(routeIndex, appSource.indexOf('\n', routeIndex))
    assert.doesNotMatch(routeLine, /Navigate to="\/propagation\//)
    assert.doesNotMatch(routeLine, /PropagationPage/)
  }
})
