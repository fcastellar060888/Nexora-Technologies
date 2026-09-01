import test from 'node:test'
import assert from 'node:assert/strict'
import { projectMipePassportTrace } from '../src/core/passport/mipePassportProjection.js'

const baseState=()=>({
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[{id:'site-a',organizationId:'org-a'},{id:'site-b',organizationId:'org-b'}],
 findings:[{id:'finding-1',organizationId:'org-a',siteId:'site-a',targetType:'POSITION',targetId:'pos-a',plantPositionId:'pos-a',incidentId:'incident-1',status:'Detectado',reportedAt:'2026-09-01T00:00:00.000Z'}],
 incidents:[{id:'incident-1',organizationId:'org-a',name:'Incidente A'}],
 plantPositions:[{id:'pos-a',organizationId:'org-a',siteId:'site-a'}],
 treatments:[],mipeInterventions:[],products:[],inventoryLots:[]
})

const project=state=>projectMipePassportTrace(state,{organizationId:'org-a',targetType:'POSITION',targetId:'pos-a'})

test('F011 certification: explicit same-tenant Tratamiento Intervention without treatmentId must fail closed',()=>{
 const state=baseState()
 state.mipeInterventions.push({id:'int-bad',organizationId:'org-a',siteId:'site-a',findingId:'finding-1',type:'Tratamiento',performedAt:'2026-09-01T01:00:00.000Z'})
 assert.throws(()=>project(state),/Treatment canónico|Tratamiento requiere/i)
})

test('F011 certification: explicit same-tenant Intervention cannot be satisfied by foreign-tenant Treatment homonym',()=>{
 const state=baseState()
 state.treatments.push({id:'tx-1',organizationId:'org-b',siteId:'site-b',findingId:'finding-1',status:'Ejecutado'})
 state.mipeInterventions.push({id:'int-bad',organizationId:'org-a',siteId:'site-a',findingId:'finding-1',treatmentId:'tx-1',type:'Tratamiento',performedAt:'2026-09-01T01:00:00.000Z'})
 assert.throws(()=>project(state),/Treatment ajeno|cadena causal|Treatment/i)
})

test('F011 certification: legitimate foreign-tenant homonym remains isolated',()=>{
 const state=baseState()
 state.findings.push({id:'finding-1',organizationId:'org-b',siteId:'site-b',targetType:'POSITION',targetId:'pos-b',plantPositionId:'pos-b',status:'Detectado',reportedAt:'2026-09-01T00:00:00.000Z'})
 state.plantPositions.push({id:'pos-b',organizationId:'org-b',siteId:'site-b'})
 state.mipeInterventions.push({id:'int-foreign',organizationId:'org-b',siteId:'site-b',findingId:'finding-1',type:'Tratamiento',performedAt:'2026-09-01T01:00:00.000Z'})
 assert.doesNotThrow(()=>project(state))
})

test('F011 certification: valid Seguimiento without Treatment remains allowed',()=>{
 const state=baseState()
 state.mipeInterventions.push({id:'int-followup',organizationId:'org-a',siteId:'site-a',findingId:'finding-1',type:'Seguimiento',performedAt:'2026-09-01T01:00:00.000Z',outcome:'Sin novedad'})
 const trace=project(state)
 assert.ok(trace)
})
