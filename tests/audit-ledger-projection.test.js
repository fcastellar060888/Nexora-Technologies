import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{auditTrailForActiveOrganization}from'../src/domain/observability.js'

const event=(id,organizationId,action)=>({id,sequence:1,recordedAt:'2026-08-18T12:00:00.000Z',event:{eventId:id,name:'inventory.stock.updated',version:1,aggregate:{type:'inventory.stock',id:'stock-1'},context:{organizationId,siteId:'site-1',actorId:'user-1'},occurredAt:'2026-08-18T12:00:00.000Z',payload:{label:action},metadata:{actorName:'Admin'}}})

test('M4.6 F006: effective audit trail merges tenant generic audit and operational ledger with ledger precedence',()=>{
 const state={
  currentContext:{companyId:'org-a'},companies:[{id:'org-a'},{id:'org-b'}],sites:[],
  auditLog:[
   {id:'generic-a',organizationId:'org-a',createdAt:'2026-08-18T11:00:00.000Z',module:'Inventario',action:'Cambio genérico'},
   {id:'evt-a',organizationId:'org-a',createdAt:'2026-08-18T12:00:00.000Z',module:'Sistema',action:'Copia del bridge'},
   {id:'generic-b',organizationId:'org-b',createdAt:'2026-08-18T13:00:00.000Z',module:'Inventario',action:'B'}
  ],
  operationalLedgerEntries:[event('evt-a','org-a','Ledger A'),event('evt-b','org-b','Ledger B')]
 }
 const trail=auditTrailForActiveOrganization(state)
 assert.deepEqual(trail.map(item=>item.id),['generic-a','evt-a'])
 assert.equal(trail.find(item=>item.id==='evt-a').source,'operational-ledger')
 assert.equal(trail.find(item=>item.id==='generic-a').source,'generic-audit')
 assert.equal(trail.some(item=>item.id==='evt-b'||item.id==='generic-b'),false)
})

test('M4.6 F006: AuditLogPage renders the effective durable trail rather than relying on bridge-populated auditLog only',()=>{
 const source=readFileSync(new URL('../src/pages/AuditLogPage.jsx',import.meta.url),'utf8')
 assert.match(source,/auditTrailForActiveOrganization/)
 assert.match(source,/operational-ledger|source/)
})
