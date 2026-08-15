import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{createDomainEvent,DomainEvents,isKnownDomainEvent}from'../src/core/events/index.js'
import{domainEventToAuditEntry}from'../src/core/audit/domainEventAudit.js'

test('proyecta un evento de dominio a auditoría con trazabilidad',()=>{
 const event=createDomainEvent({name:DomainEvents.SITE_CREATED,aggregateType:'site',aggregateId:'site-1',organizationId:'company-1',siteId:'site-1',actorId:'user-1',occurredAt:'2026-07-31T21:00:00.000Z',eventId:'event-1',payload:{label:'Canapa · Villeta'},metadata:{actorName:'Fer',collections:['sites']}})
 const entry=domainEventToAuditEntry(event)
 assert.equal(entry.id,'event-1')
 assert.equal(entry.actor,'Fer')
 assert.equal(entry.action,'Sede creada')
 assert.equal(entry.module,'Configuración')
 assert.equal(entry.aggregateId,'site-1')
 assert.equal(entry.organizationId,'company-1')
 assert.deepEqual(entry.collections,['sites'])
})

test('el evento de selección de sesión pertenece al catálogo',()=>{
 assert.equal(DomainEvents.USER_SESSION_SELECTED,'identity.user.session_selected')
 assert.equal(isKnownDomainEvent(DomainEvents.USER_SESSION_SELECTED),true)
})

test('los dominios publican eventos y auditoría proyecta desde el Ledger del workspace',async()=>{
 const companies=await readFile(new URL('../src/pages/CompaniesPage.jsx',import.meta.url),'utf8')
 const sites=await readFile(new URL('../src/pages/SitesPage.jsx',import.meta.url),'utf8')
 const users=await readFile(new URL('../src/pages/UsersPage.jsx',import.meta.url),'utf8')
 const boundary=await readFile(new URL('../src/services/coreOperationCommand.js',import.meta.url),'utf8')
 for(const source of[companies,sites]){
  assert.match(source,/publishDomainEvent/)
  assert.match(source,/executeCoreOperationCommand/)
 }
 assert.match(users,/publishDomainEvent/)
 assert.match(users,/audit:false/)
 assert.match(boundary,/commit\(current=>spec\.apply\(current\),\{audit:false\}\)/)
 assert.match(boundary,/CORE_OPERATION_REQUESTED/)
 const bridge=await readFile(new URL('../src/core/audit/DomainEventAuditBridge.jsx',import.meta.url),'utf8')
 assert.match(bridge,/getOperationalLedgerForScope\(scope\)/)
 assert.match(bridge,/ledger\.subscribe/)
 assert.match(bridge,/organizationId===companyId/)
 assert.match(bridge,/operationalLedgerEntries/)
 assert.doesNotMatch(bridge,/import\{[^}]*operationalLedger[^}]*\}/)
 assert.doesNotMatch(bridge,/eventBus\.subscribe/)
 assert.match(bridge,/some\(item=>item\.id===entry\.id\)/)
})
