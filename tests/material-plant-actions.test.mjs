import test from'node:test'
import assert from'node:assert/strict'
import{applyMaterialPlantUnitPatch,upsertMaterialPlantUnit}from'../src/domain/materialPlantActions.js'

const plant={id:'lot-1:MOTHER:1',lotId:'lot-1',plantType:'MOTHER',unitIndex:0,code:'LM-001-M001',siteId:'site-1',geneticId:'gen-1',status:'Activa',healthStatus:'Sana'}

test('persiste un override individual sin modificar la identidad estable',()=>{
 const units=upsertMaterialPlantUnit([],plant,{healthStatus:'En seguimiento',notes:'Revisar mañana'})
 assert.equal(units.length,1)
 assert.equal(units[0].id,plant.id)
 assert.equal(units[0].healthStatus,'En seguimiento')
 assert.equal(units[0].notes,'Revisar mañana')
 assert.ok(units[0].updatedAt)
})

test('actualiza el override existente sin duplicarlo',()=>{
 const first=upsertMaterialPlantUnit([],plant,{status:'Activa'})
 const second=upsertMaterialPlantUnit(first,plant,{status:'Retirada'})
 assert.equal(second.length,1)
 assert.equal(second[0].status,'Retirada')
})

test('aplica una acción masiva a cada planta seleccionada',()=>{
 const second={...plant,id:'lot-1:MOTHER:2',unitIndex:1,code:'LM-001-M002'}
 const state=applyMaterialPlantUnitPatch({materialPlantUnits:[]},[plant,second],{healthStatus:'No apta'})
 assert.equal(state.materialPlantUnits.length,2)
 assert.ok(state.materialPlantUnits.every(item=>item.healthStatus==='No apta'))
})
