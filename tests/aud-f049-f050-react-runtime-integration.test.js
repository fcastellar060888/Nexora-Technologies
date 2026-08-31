import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function withViteModule(modulePath, run) {
  const server = await createServer({
    root: ROOT,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })

  try {
    const module = await server.ssrLoadModule(modulePath)
    return await run(module)
  } finally {
    await server.close()
  }
}

test('AUD-F049: application error boundary exposes executable isolation and reporting behavior', async () => {
  await withViteModule('/src/components/ApplicationErrorBoundary.js', async ({ ApplicationErrorBoundary }) => {
    const error = new Error('synthetic runtime failure')
    const componentStack = '\n    at SyntheticRoute'
    const reports = []
    const boundary = new ApplicationErrorBoundary({
      children: React.createElement('span', null, 'healthy child'),
      onError: (caught, info) => reports.push({ caught, info }),
    })

    assert.deepEqual(ApplicationErrorBoundary.getDerivedStateFromError(error), { error })

    boundary.state = { error }
    const fallback = renderToStaticMarkup(boundary.render())
    assert.match(fallback, /role="alert"/)
    assert.match(fallback, /Nexora One no pudo completar esta vista/)
    assert.doesNotMatch(fallback, /healthy child/)

    boundary.componentDidCatch(error, { componentStack })
    assert.equal(reports.length, 1)
    assert.equal(reports[0].caught, error)
    assert.equal(reports[0].info.componentStack, componentStack)
  })
})

test('AUD-F050: React route component is exercised through a real render cycle, not source inspection', async () => {
  await withViteModule('/src/pages/ProductionUnavailablePage.jsx', async ({ default: ProductionUnavailablePage }) => {
    const tree = React.createElement(
      MemoryRouter,
      { initialEntries: ['/production/harvest'] },
      React.createElement(ProductionUnavailablePage),
    )

    const html = renderToStaticMarkup(tree)

    assert.match(html, /<h1 id="production-unavailable-title">Cosecha<\/h1>/)
    assert.match(html, /dominio operacional diferente/)
    assert.match(html, /href="\/dashboard"/)
    assert.doesNotMatch(html, /Propagación<\/a>/)
  })
})
