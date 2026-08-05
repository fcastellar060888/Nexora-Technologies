import test from 'node:test'
import assert from 'node:assert/strict'
import { createReplaySessionManager } from '../src/core/projectionEngine/index.js'

const ledger = Object.freeze({ find: () => [] })
const engine = Object.freeze({ replay: async () => ({ status: 'succeeded' }) })

test('Auditoría V2 replay sessions: un inicio inválido no compacta evidencia terminal existente', async () => {
  const ids = ['session-1', '']
  const manager = createReplaySessionManager(ledger, engine, {
    maxSessions: 1,
    now: () => Date.parse('2026-08-05T02:00:00.000Z'),
    idFactory: () => ids.shift()
  })

  const first = manager.start()
  await first.completion

  assert.equal(manager.getSession('session-1')?.status, 'completed')
  assert.throws(
    () => manager.start(),
    /requiere un identificador/
  )

  assert.equal(manager.getSession('session-1')?.status, 'completed')
  assert.equal(manager.status().sessions, 1)
  assert.equal(manager.status().terminal, 1)
})

test('Auditoría V2 replay sessions: un idFactory defectuoso no elimina sesiones para luego fallar', async () => {
  let calls = 0
  const manager = createReplaySessionManager(ledger, engine, {
    maxSessions: 1,
    now: () => Date.parse('2026-08-05T02:00:00.000Z'),
    idFactory: () => {
      calls += 1
      if (calls === 1) return 'session-1'
      throw new Error('generador de identidad no disponible')
    }
  })

  await manager.start().completion

  assert.throws(
    () => manager.start(),
    /generador de identidad no disponible/
  )

  assert.equal(manager.getSession('session-1')?.status, 'completed')
  assert.equal(manager.status().sessions, 1)
})
