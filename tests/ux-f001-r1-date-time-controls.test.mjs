import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('date and time controls keep Safari internal values left aligned', async () => {
  const css = await read('src/styles/date-time-controls.css')
  assert.match(css, /::-webkit-date-and-time-value/)
  assert.match(css, /justify-content:\s*flex-start/)
  assert.match(css, /text-align:\s*start\s*!important/)
  assert.match(css, /::-webkit-datetime-edit-fields-wrapper/)
  assert.match(css, /::-webkit-calendar-picker-indicator/)
})

test('date and time normalization loads after other global styles', async () => {
  const main = await read('src/main.jsx')
  const accessibility = main.indexOf("./styles/accessibility-fixes.css")
  const dateTime = main.indexOf("./styles/date-time-controls.css")
  assert.ok(accessibility >= 0, 'accessibility styles must remain loaded')
  assert.ok(dateTime > accessibility, 'date/time normalization must load last')
})

test('infrastructure environmental reading uses the Safari-safe split date and time control', async () => {
  const page = await read('src/pages/InfrastructureOperationsPage.jsx')
  const panel = await read('src/components/EnvironmentMeasurementsPanel.jsx')
  assert.match(page, /import EnvironmentMeasurementsPanel/)
  assert.match(page, /<EnvironmentMeasurementsPanel/)
  assert.match(panel, /import DateTimeFields/)
  assert.match(panel, /label="Fecha y hora"/)
  assert.match(panel, /<DateTimeFields value=\{reading\.recordedAt\}/)
  assert.match(panel, /onChange=\{recordedAt=>setReading\(\{\.\.\.reading,recordedAt\}\)\}/)
})

