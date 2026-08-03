import test from'node:test'
import assert from'node:assert/strict'
import{hydrateAuthoritativeState}from'../src/services/remoteBootstrap.js'

const baseState={
 currentContext:{companyId:'company-1'},
 companies:[],users:[],roles:[],memberships:[],userSessions:[],auditLog:[],
 syncQueue:[],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],syncMeta:{},
 grandmotherPlants:[],motherPlants:[],materialPlantUnits:[]
}

const row=(collection,recordId,payload)=>({
 organization_id:'company-1',collection,record_id:recordId,payload,version:1,
 updated_at:'2026-08-03T06:00:00.000Z',deleted_at:null
})

test('AUD-F017: bootstrap materializa la población remota antes de entregar el Store',()=>{
 const hydrated=hydrateAuthoritativeState(baseState,[
  row('grandmotherPlants','g1',{id:'g1',lotCode:'LAB-1',quantity:2,createdAt:'2026-01-01T00:00:00.000Z'}),
  row('motherPlants','m1',{id:'m1',lotCode:'LM-1',quantity:1,createdAt:'2026-02-01T00:00:00.000Z'})
 ],{companyId:'company-1',hydratedAt:'2026-08-03T06:10:00.000Z'})
 assert.deepEqual(hydrated.materialPlantUnits.map(item=>item.id),[
  'material-plant:GRANDMOTHER:g1:1',
  'material-plant:GRANDMOTHER:g1:2',
  'material-plant:MOTHER:m1:1'
 ])
 assert.ok(hydrated.materialPlantIdentityRegistry['GRANDMOTHER:g1'])
 assert.ok(hydrated.materialPlantIdentityRegistry['MOTHER:m1'])
})

test('AUD-F017: bootstrap conserva vidas remotas materializadas y completa solo faltantes históricos',()=>{
 const hydrated=hydrateAuthoritativeState(baseState,[
  row('grandmotherPlants','g1',{id:'g1',lotCode:'LAB-1',quantity:2,createdAt:'2026-01-01T00:00:00.000Z'}),
  row('materialPlantUnits','external-life',{id:'external-life',lotId:'g1',plantType:'GRANDMOTHER',unitIndex:0,code:'ELITE-1',status:'Retirada',createdAt:'2026-01-01T00:00:00.000Z'})
 ],{companyId:'company-1'})
 assert.equal(hydrated.materialPlantUnits.length,2)
 assert.equal(hydrated.materialPlantUnits[0].id,'external-life')
 assert.equal(hydrated.materialPlantUnits[0].status,'Retirada')
 assert.ok(hydrated.materialPlantUnits.some(item=>item.id==='material-plant:GRANDMOTHER:g1:2'))
})
