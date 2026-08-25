import test from'node:test'
import assert from'node:assert/strict'
import{MATERIAL_PLANT_TYPES,legacyMaterialPlantId,projectLotPlantUnits,projectMaterialPlantUnits}from'../src/domain/materialPlantIdentity.js'

const lot=(organizationId,siteId,id='lot-shared')=>({id,organizationId,siteId,lotCode:`${organizationId}-LOT`,quantity:1,geneticId:`gen-${organizationId}`,status:'Activa',createdAt:'2026-08-17T08:00:00.000Z'})
const unit=(organizationId,siteId,id='material-plant:GRANDMOTHER:lot-shared:1')=>({id,organizationId,plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,unitIndex:0,lotId:'lot-shared',siteId,geneticId:`gen-${organizationId}`,status:'Activa',healthStatus:'Sana',operationalAvailability:'En recuperación',createdAt:'2026-08-17T08:00:00.000Z',updatedAt:'2026-08-17T09:00:00.000Z'})
const base=()=>({companies:[{id:'org-a'},{id:'org-b'}],sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'},{id:'site-b',organizationId:'org-b',companyId:'org-b'}],grandmotherPlants:[lot('org-a','site-a'),lot('org-b','site-b')],motherPlants:[],materialPlantUnits:[],materialPlantIdentityRegistry:{}})

test('F012 material identity: override válido conserva estado individual pero hereda lote/sede canónicos',()=>{
 const source=lot('org-a','site-a','lot-a'),id=legacyMaterialPlantId({lot:source,plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,unitIndex:0}),override={...unit('org-a','site-a',id),lotId:'lot-a',notes:'Override sanitario'}
 const projected=projectLotPlantUnits(source,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,overrides:[override]})
 assert.equal(projected.length,1)
 assert.equal(projected[0].organizationId,'org-a')
 assert.equal(projected[0].siteId,'site-a')
 assert.equal(projected[0].operationalAvailability,'En recuperación')
 assert.equal(projected[0].notes,'Override sanitario')
})

test('F012 material identity: override same-tenant no puede cambiar la sede del lote',()=>{
 const source=lot('org-a','site-a','lot-a'),id=legacyMaterialPlantId({lot:source,plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,unitIndex:0}),override={...unit('org-a','site-b',id),lotId:'lot-a'}
 assert.throws(()=>projectLotPlantUnits(source,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,overrides:[override]}),/sede canónica|contradice.*sede/i)
})

test('F012 material identity: unidad huérfana se cuarentena y no aparece como planta material canónica',()=>{
 const state=base();state.materialPlantUnits=[{...unit('org-a','site-a','orphan-a'),lotId:'lot-missing'}]
 const projected=projectMaterialPlantUnits(state)
 assert.equal(projected.some(item=>item.id==='orphan-a'),false)
 assert.ok(projected.some(item=>item.organizationId==='org-a'&&item.lotId==='lot-shared'))
})

test('F012 material identity: lotes homónimos cross-tenant aíslan overrides y un corrupto extranjero no bloquea el tenant válido',()=>{
 const state=base(),sharedId='material-plant:GRANDMOTHER:lot-shared:1'
 state.materialPlantUnits=[
  unit('org-a','site-a',sharedId),
  {...unit('org-b','site-a',sharedId),operationalAvailability:'Bloqueada por MIPE'}
 ]
 const projected=projectMaterialPlantUnits(state),local=projected.filter(item=>item.id===sharedId&&item.organizationId==='org-a'),foreign=projected.filter(item=>item.id===sharedId&&item.organizationId==='org-b')
 assert.equal(local.length,1)
 assert.equal(local[0].siteId,'site-a')
 assert.equal(local[0].operationalAvailability,'En recuperación')
 assert.equal(foreign.length,0,'El override org-b contradice su lote site-b y debe quedar en cuarentena')
})
