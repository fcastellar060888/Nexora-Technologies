import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(path, 'utf8')

test('la identidad visible del producto es Nexora One', () => {
  const shell = read('src/components/AppShell.jsx')
  const login = read('src/pages/LoginPage.jsx')
  const index = read('index.html')
  const pkg = JSON.parse(read('package.json'))

  assert.match(shell, /Nexora One/)
  assert.match(shell, /Nexora Technologies/)
  assert.match(login, /Nexora One/)
  assert.match(index, /<title>Nexora One<\/title>/)
  assert.equal(pkg.name, 'nexora-one')
  assert.equal(pkg.version, '7.0.0')
})

test('Canapa no se presenta como nombre del producto', () => {
  const visibleFiles = [
    read('src/components/AppShell.jsx'),
    read('src/pages/LoginPage.jsx'),
    read('index.html')
  ].join('\n')

  assert.doesNotMatch(visibleFiles, /Canapa ERP/i)
})
