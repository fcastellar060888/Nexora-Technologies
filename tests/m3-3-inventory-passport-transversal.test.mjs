import test from'node:test'
import assert from'node:assert/strict'
import{buildInventoryPassport}from'../src/domain/inventoryPassport.js'

const org='org-a'
const product=id=>({id,organizationId:org,name:id,unit:'mL'})
const lot=(id,productId)=>({id,organizationId:org,productId,siteId:'s1',quantity:8})
const movement=(id,productId,lotId,sourceId='t1')=>({id,organizationId:org,productId,lotId,siteId:'s1',type:'Consumo',date:'2026-08-27',quantity:1,signedQuantity:-1,balanceBefore:9,balanceAfter:8,ledgerSequence:1,previousMovementId:'',unit:'mL',unitCost:5,sourceType:'MipeTreatment',sourceId})
const treatment=id=>({id,organizationId:org,siteId:'s1',status:'Ejecutado'})

test('full Passport fails when MIPE cost points only to foreign or non-causal movement evidence',()=>{
 const foreignMovement={...movement('fm','p1','l1'),organizationId:'org-b'}
 const state={products:[product('p1')],inventoryLots:[lot('l1','p1')],inventoryMovements:[foreignMovement],treatments:[treatment('t1')],tankPreparations:[],costEntries:[{id:'c1',organizationId:org,module:'MIPE',amount:5,sourceType:'MipeTreatment',sourceId:'t1',inventoryMovementIds:['fm']}]}
 assert.throws(()=>buildInventoryPassport(state,{organizationId:org}),/no resuelve movimientos válidos dentro del tenant/)
})

test('filtered Product Passport ignores a complete valid cost chain belonging only to another Product',()=>{
 const p1=product('p1'),p2=product('p2'),l1=lot('l1','p1'),l2=lot('l2','p2'),m1=movement('m1','p1','l1','t1'),m2=movement('m2','p2','l2','t2')
 const state={products:[p1,p2],inventoryLots:[l1,l2],inventoryMovements:[m1,m2],treatments:[treatment('t1'),treatment('t2')],tankPreparations:[],costEntries:[{id:'c1',organizationId:org,module:'MIPE',amount:5,sourceType:'MipeTreatment',sourceId:'t1',inventoryMovementIds:['m1']},{id:'c2',organizationId:org,module:'MIPE',amount:5,sourceType:'MipeTreatment',sourceId:'t2',inventoryMovementIds:['m2']}]}
 const graph=buildInventoryPassport(state,{organizationId:org,productId:'p1'})
 assert.equal(graph.summary.products,1)
 assert.equal(graph.summary.movements,1)
 assert.equal(graph.summary.costEntries,1)
 assert.equal(graph.nodes.some(node=>node.key==='CostEntry:c2'),false)
})

test('Passport fails closed on duplicate Product identity inside the same tenant even when records are identical',()=>{
 const p=product('p1')
 const state={products:[p,{...p}],inventoryLots:[],inventoryMovements:[],treatments:[],tankPreparations:[],costEntries:[]}
 assert.throws(()=>buildInventoryPassport(state,{organizationId:org}),/Products del Passport contiene identidad duplicada dentro del tenant/)
})

test('Passport fails closed on duplicate Lot, Movement and CostEntry identities inside the same tenant',()=>{
 const p=product('p1'),l=lot('l1','p1'),m=movement('m1','p1','l1'),c={id:'c1',organizationId:org,module:'MIPE',amount:5,sourceType:'MipeTreatment',sourceId:'t1',inventoryMovementIds:['m1']}
 assert.throws(()=>buildInventoryPassport({products:[p],inventoryLots:[l,{...l}],inventoryMovements:[],treatments:[],tankPreparations:[],costEntries:[]},{organizationId:org}),/Lots del Passport contiene identidad duplicada dentro del tenant/)
 assert.throws(()=>buildInventoryPassport({products:[p],inventoryLots:[l],inventoryMovements:[m,{...m}],treatments:[treatment('t1')],tankPreparations:[],costEntries:[]},{organizationId:org}),/Movements del Passport contiene identidad duplicada dentro del tenant/)
 assert.throws(()=>buildInventoryPassport({products:[p],inventoryLots:[l],inventoryMovements:[m],treatments:[treatment('t1')],tankPreparations:[],costEntries:[c,{...c}]},{organizationId:org}),/CostEntries del Passport contiene identidad duplicada dentro del tenant/)
})

test('full Passport fails closed instead of silently dropping a same-tenant orphan Lot',()=>{
 const state={products:[product('p1')],inventoryLots:[lot('orphan','missing-product')],inventoryMovements:[],treatments:[],tankPreparations:[],costEntries:[]}
 assert.throws(()=>buildInventoryPassport(state,{organizationId:org}),/InventoryLot same-tenant sin Product causal válido/)
})

test('full Passport fails closed instead of silently dropping a same-tenant orphan or contradictory Movement',()=>{
 const p1=product('p1'),p2=product('p2'),l1=lot('l1','p1')
 const orphan=movement('orphan','p1','missing-lot')
 assert.throws(()=>buildInventoryPassport({products:[p1],inventoryLots:[l1],inventoryMovements:[orphan],treatments:[treatment('t1')],tankPreparations:[],costEntries:[]},{organizationId:org}),/InventoryMovement same-tenant sin cadena Lot → Product causal válida/)
 const contradictory=movement('contradictory','p2','l1')
 assert.throws(()=>buildInventoryPassport({products:[p1,p2],inventoryLots:[l1],inventoryMovements:[contradictory],treatments:[treatment('t1')],tankPreparations:[],costEntries:[]},{organizationId:org}),/InventoryMovement same-tenant sin cadena Lot → Product causal válida/)
})

test('Passport preserves valid legacy Lot and Movement whose tenant is resolved causally from site',()=>{
 const legacyLot={...lot('l1','p1')};delete legacyLot.organizationId
 const legacyMovement={...movement('m1','p1','l1')};delete legacyMovement.organizationId
 const state={companies:[{id:org}],currentContext:{companyId:org},sites:[{id:'s1',organizationId:org}],products:[product('p1')],inventoryLots:[legacyLot],inventoryMovements:[legacyMovement],treatments:[treatment('t1')],tankPreparations:[],costEntries:[{id:'c1',organizationId:org,module:'MIPE',amount:5,sourceType:'MipeTreatment',sourceId:'t1',inventoryMovementIds:['m1']}]}
 const graph=buildInventoryPassport(state,{organizationId:org})
 assert.equal(graph.summary.products,1)
 assert.equal(graph.summary.lots,1)
 assert.equal(graph.summary.movements,1)
 assert.equal(graph.summary.costEntries,1)
 assert.equal(graph.nodes.some(node=>node.key==='InventoryLot:l1'),true)
 assert.equal(graph.nodes.some(node=>node.key==='InventoryMovement:m1'),true)
})
