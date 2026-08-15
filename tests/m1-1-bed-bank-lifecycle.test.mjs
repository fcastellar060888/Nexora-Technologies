import test from'node:test'
import assert from'node:assert/strict'
import{archiveBed,archivePropagationBank,assertBankCapacity}from'../src/domain/facilityLifecycle.js'
import{DomainEvents,isKnownDomainEvent}from'../src/core/events/eventCatalog.js'

test('M1.1-C: cama vacía se archiva sin eliminar posiciones históricas',()=>{
 const state={beds:[{id:'bed-1',active:true}],plantPositions:[{id:'p-1',bedId:'bed-1',active:false,status:'Vacía'}]}
 const next=archiveBed(state,'bed-1',{archivedAt:'2026-08-07T16:00:00.000Z'})
 assert.equal(next.beds[0].active,false)
 assert.equal(next.beds[0].archivedAt,'2026-08-07T16:00:00.000Z')
 assert.equal(next.plantPositions.length,1)
 assert.equal(next.plantPositions[0].id,'p-1')
})

test('M1.1-C: cama con posición vegetal activa no puede archivarse',()=>{
 const state={beds:[{id:'bed-1',active:true}],plantPositions:[{id:'p-1',bedId:'bed-1',active:true,status:'Activa'}]}
 assert.throws(()=>archiveBed(state,'bed-1'),/posición activa/)
 assert.equal(state.beds[0].active,true)
})

test('M1.1-C: banco vacío se archiva conservando bandejas',()=>{
 const state={propagationBanks:[{id:'bank-1',active:true,trays:[{id:'tray-1',quantity:1,cellsPerTray:30}]}],propagationUnits:[],propagationBatches:[]}
 const next=archivePropagationBank(state,'bank-1',{archivedAt:'2026-08-07T16:00:00.000Z'})
 assert.equal(next.propagationBanks[0].active,false)
 assert.equal(next.propagationBanks[0].trays[0].id,'tray-1')
})

test('M1.1-C: banco con esquejes o lotes activos no puede archivarse',()=>{
 const withUnit={propagationBanks:[{id:'bank-1',active:true}],propagationUnits:[{id:'u-1',bankId:'bank-1',status:'Enraizando'}],propagationBatches:[]}
 assert.throws(()=>archivePropagationBank(withUnit,'bank-1'),/esqueje activo/)
 const withBatch={propagationBanks:[{id:'bank-1',active:true}],propagationUnits:[],propagationBatches:[{id:'b-1',bankId:'bank-1',status:'Activo',phase:'Enraizamiento'}]}
 assert.throws(()=>archivePropagationBank(withBatch,'bank-1'),/lote activo/)
})

test('M1.1-C: configuración de bandejas no puede reducir capacidad bajo la ocupación',()=>{
 const bank={id:'bank-1',trays:[{id:'tray-1',quantity:1,cellsPerTray:2}]}
 const units=[{id:'u-1',bankId:'bank-1',status:'Enraizando'},{id:'u-2',bankId:'bank-1',status:'Enraizando'},{id:'u-3',bankId:'bank-1',status:'Enraizando'}]
 assert.throws(()=>assertBankCapacity(bank,units),/no puede ser menor/)
})

test('M1.1-C: catálogo reconoce lifecycle no destructivo de camas y bancos',()=>{
 for(const name of[DomainEvents.FACILITY_BED_CREATED,DomainEvents.FACILITY_BED_UPDATED,DomainEvents.FACILITY_BED_ARCHIVED,DomainEvents.PROPAGATION_BANK_CREATED,DomainEvents.PROPAGATION_BANK_UPDATED,DomainEvents.PROPAGATION_BANK_ARCHIVED])assert.equal(isKnownDomainEvent(name),true)
})
