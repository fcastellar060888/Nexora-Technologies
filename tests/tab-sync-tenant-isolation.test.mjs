import test from'node:test'
import assert from'node:assert/strict'
import{activeOrganizationId,isOrganizationMessageAllowed}from'../src/services/tabSyncCoordinator.js'

test('AUD-F016: lee la empresa activa desde la identidad segmentada',()=>{
 const storage={getItem:key=>key==='cannapa_cache_v2:identity'?JSON.stringify({currentContext:{companyId:'company-a'}}):null}
 assert.equal(activeOrganizationId(storage),'company-a')
})

test('AUD-F016: rechaza mensajes entre pestañas de otra empresa o sin empresa',()=>{
 assert.equal(isOrganizationMessageAllowed({companyId:'company-a'},'company-a'),true)
 assert.equal(isOrganizationMessageAllowed({companyId:'company-b'},'company-a'),false)
 assert.equal(isOrganizationMessageAllowed({},'company-a'),false)
 assert.equal(isOrganizationMessageAllowed({companyId:'company-a'},''),false)
})
