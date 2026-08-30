import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ApplicationErrorBoundary } from '../src/components/ApplicationErrorBoundary.js'

test('M4.6 F005 — boundary derives an isolated failure state from an uncaught React error', () => {
  const error = new Error('render exploded')

  assert.deepEqual(
    ApplicationErrorBoundary.getDerivedStateFromError(error),
    { error },
  )
})

test('M4.6 F005 — boundary reports the original error and React component stack', () => {
  const received = []
  const error = new Error('runtime failure')
  const info = { componentStack: '\n    at BrokenWidget' }
  const boundary = new ApplicationErrorBoundary({
    children: 'healthy-child',
    onError: (...args) => received.push(args),
  })

  boundary.componentDidCatch(error, info)

  assert.equal(received.length, 1)
  assert.equal(received[0][0], error)
  assert.equal(received[0][1], info)
})

test('M4.6 F005 — healthy children pass through unchanged', () => {
  const child = { sentinel: 'healthy-runtime' }
  const boundary = new ApplicationErrorBoundary({ children: child })

  assert.equal(boundary.render(), child)
})

test('M4.6 F005 — failed runtime renders an accessible fail-closed recovery surface', () => {
  const boundary = new ApplicationErrorBoundary({ children: 'must-not-render' })
  boundary.state = { error: new Error('boom') }

  const fallback = boundary.render()

  assert.equal(fallback.type, 'main')
  assert.equal(fallback.props.role, 'alert')
  assert.equal(fallback.props['aria-live'], 'assertive')

  const children = fallback.props.children
  assert.equal(children[0].type, 'h1')
  assert.match(children[0].props.children, /Nexora One/)
  assert.equal(children[2].type, 'button')
  assert.equal(children[2].props.type, 'button')
})

test('M4.6 F005 — application root is actually wrapped by the boundary', async () => {
  const mainSource = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8')

  assert.match(mainSource, /import ApplicationErrorBoundary from '\.\/components\/ApplicationErrorBoundary\.js'/)
  assert.match(mainSource, /<React\.StrictMode><ApplicationErrorBoundary><BrowserRouter>/)
  assert.match(mainSource, /<App\/><\/RealtimeProvider>.*<\/ApplicationErrorBoundary><\/React\.StrictMode>/)
})
