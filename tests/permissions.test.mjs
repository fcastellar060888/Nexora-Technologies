import test from 'node:test'
import assert from 'node:assert/strict'
import { activeUser, hasPermission } from '../src/services/permissions.js'

test('installation mode allows access before users exist', () => {
  const state = { users: [] }
  assert.equal(activeUser(state), null)
  assert.equal(hasPermission(state, 'manage_inventory'), true)
})

test('configured system denies access without an active session', () => {
  const state = {
    users: [{ id:'u1', name:'Ana', role:'Administrador', active:true, activeSession:false }],
  }
  assert.equal(activeUser(state), null)
  assert.equal(hasPermission(state, 'manage_inventory'), false)
})

test('inactive users never receive permissions', () => {
  const state = {
    users: [{ id:'u1', name:'Ana', role:'Administrador', active:false, activeSession:true }],
  }
  assert.equal(activeUser(state), null)
  assert.equal(hasPermission(state, 'manage_inventory'), false)
})

test('administrator receives wildcard permissions', () => {
  const state = {
    users: [{ id:'u1', name:'Ana', role:'Administrador', active:true, activeSession:true }],
  }
  assert.equal(activeUser(state)?.id, 'u1')
  assert.equal(hasPermission(state, 'manage_inventory'), true)
  assert.equal(hasPermission(state, 'unknown_permission'), true)
})

test('role permissions are limited to their declared capabilities', () => {
  const state = {
    users: [{ id:'u2', name:'Luis', role:'Encargado MIPE', active:true, activeSession:true }],
  }
  assert.equal(hasPermission(state, 'manage_mipe'), true)
  assert.equal(hasPermission(state, 'execute_treatments'), true)
  assert.equal(hasPermission(state, 'view_costs'), false)
})

test('unknown roles are denied by default', () => {
  const state = {
    users: [{ id:'u3', name:'Eva', role:'Rol inexistente', active:true, activeSession:true }],
  }
  assert.equal(hasPermission(state, 'view_dashboards'), false)
})
