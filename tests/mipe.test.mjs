import test from'node:test'
import assert from'node:assert/strict'
import{activePlantRestrictions,calculateTreatmentQuantity,executeTreatment,scheduleTreatment}from'../src/domain/mipe.js'

test('calcula dosis por litro',()=>{
 assert.equal(calculateTreatmentQuantity(2,'mL/L',500),1000)
 assert.equal(calculateTreatmentQuantity(1.5,'g/L',100),150)
})

test('calcula correctamente dosis por 100 litros',()=>{
 assert.equal(calculateTreatmentQuantity(200,'mL/100 L',500),1000)
 assert.equal(calculateTreatmentQuantity(50,'g/100 L',200),100)
})

test('programa y ejecuta un tratamiento de forma transaccional',()=>{
 const base={sites:[{id:'s1'}],findings:[{id:'f1',plantPositionId:'plant1',status:'Detectado'}],products:[{id:'p1',unit:'mL',doseMin:100,doseMax:250,cost:2,reentryHours:12,withdrawalDays:3}],inventoryLots:[{id:'l1',productId:'p1',siteId:'s1',unit:'mL',quantity:1500}],inventoryMovements:[],treatments:[],costEntries:[]}
 const scheduled=scheduleTreatment(base,{id:'t1',findingId:'f1',productId:'p1',dose:200,doseUnit:'mL/100 L',mixVolume:500,createdAt:'2026-07-30T12:00:00.000Z'})
 assert.equal(scheduled.treatments[0].totalQuantity,1000)
 assert.equal(scheduled.findings[0].status,'Tratamiento aprobado')
 const executed=executeTreatment(scheduled,{treatmentId:'t1',lotId:'l1',movementId:'m1',responsible:'Ana',executedAt:'2026-07-30T15:00:00.000Z',costEntryId:'c1'})
 const opening=executed.inventoryMovements.find(item=>item.sourceType==='LegacyInventoryBootstrap')
 const movement=executed.inventoryMovements.find(item=>item.id==='m1')
 assert.equal(executed.inventoryLots[0].quantity,500)
 assert.ok(opening)
 assert.equal(opening.balanceAfter,1500)
 assert.equal(movement.signedQuantity,-1000)
 assert.equal(movement.sourceType,'MipeTreatment')
 assert.equal(movement.previousMovementId,opening.id)
 assert.equal(executed.treatments[0].status,'Ejecutado')
 assert.equal(executed.treatments[0].cost,2000)
 assert.equal(executed.findings[0].status,'Seguimiento')
 assert.equal(executed.costEntries[0].amount,2000)
 assert.equal(executed.treatments[0].reentryUntil,'2026-07-31T03:00:00.000Z')
 assert.equal(executed.treatments[0].harvestRestrictedUntil,'2026-08-02T15:00:00.000Z')
 const active=activePlantRestrictions(executed,'plant1','2026-07-31T00:00:00.000Z')
 assert.equal(active.reentryBlocked,true)
 assert.equal(active.harvestBlocked,true)
 const later=activePlantRestrictions(executed,'plant1','2026-08-03T00:00:00.000Z')
 assert.equal(later.reentryBlocked,false)
 assert.equal(later.harvestBlocked,false)
})

test('bloquea ejecución con inventario insuficiente',()=>{
 const state={sites:[{id:'s1'}],findings:[{id:'f1',status:'Tratamiento aprobado'}],products:[{id:'p1',unit:'mL',cost:1}],inventoryLots:[{id:'l1',productId:'p1',siteId:'s1',unit:'mL',quantity:50}],inventoryMovements:[],costEntries:[],treatments:[{id:'t1',findingId:'f1',productId:'p1',status:'Programado',totalQuantity:100,dose:1,doseUnit:'mL/L',mixVolume:100}]}
 assert.throws(()=>executeTreatment(state,{treatmentId:'t1',lotId:'l1',movementId:'m1'}),/existencia disponible/)
 assert.equal(state.inventoryLots[0].quantity,50)
})
