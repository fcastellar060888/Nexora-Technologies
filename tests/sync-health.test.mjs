import test from'node:test'
import assert from'node:assert/strict'
import{canAcquireLease,leaseExpired}from'../src/services/tabSyncCoordinator.js'
import{deviceHealth,healthAlerts}from'../src/services/syncHealth.js'

test('permite tomar un lease vencido o propio',()=>{
 assert.equal(leaseExpired({expiresAt:99},100),true)
 assert.equal(canAcquireLease({tabId:'a',expiresAt:200},'b',100),false)
 assert.equal(canAcquireLease({tabId:'a',expiresAt:200},'a',100),true)
})

test('detecta dispositivo con errores consecutivos',()=>{
 const events=[1,2,3].map(index=>({deviceId:'ipad-1',companyId:'org-1',status:'error',createdAt:`2026-07-31T12:0${index}:00Z`,error:'network'}))
 const health=deviceHealth(events,'org-1',Date.parse('2026-07-31T12:10:00Z'))
 assert.equal(health[0].consecutiveFailures,3)
 assert.equal(health[0].successRate,0)
 const alerts=healthAlerts(events,'org-1')
 assert.equal(alerts.some(item=>item.severity==='high'),true)
})

test('un éxito reinicia la racha de fallos',()=>{
 const events=[
  {deviceId:'ipad-1',status:'error',createdAt:'2026-07-31T12:00:00Z'},
  {deviceId:'ipad-1',status:'success',createdAt:'2026-07-31T12:01:00Z'}
 ]
 assert.equal(deviceHealth(events,'',Date.parse('2026-07-31T12:02:00Z'))[0].consecutiveFailures,0)
})
