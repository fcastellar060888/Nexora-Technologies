import test from'node:test'
import assert from'node:assert/strict'
import{buildInventoryPassport}from'../src/domain/inventoryPassport.js'

const org='org-a'
const product={id:'p1',organizationId:org,name:'Neem',unit:'mL',cost:99}
const lot={id:'l1',organizationId:org,productId:'p1',siteId:'s1',lotNumber:'LOT-1',quantity:8}
const movement={id:'m1',organizationId:org,productId:'p1',lotId:'l1',siteId:'s1',type:'Consumo',date:'2026-08-27',quantity:2,signedQuantity:-2,balanceBefore:10,balanceAfter:8,ledgerSequence:1,previousMovementId:'',unit:'mL',unitCost:5,sourceType:'MipeTreatment',sourceId:'t1'}
const treatment={id:'t1',organizationId:org,siteId:'s1',status:'Ejecutado',executedAt:'2026-08-27T18:00:00.000Z'}
const cost={id:'c1',organizationId:org,module:'MIPE',amount:10,sourceType:'MipeTreatment',sourceId:'t1',inventoryMovementId:'m1',inventoryMovementIds:['m1']}
const state=(overrides={})=>({products:[product],inventoryLots:[lot],inventoryMovements:[movement],costEntries:[cost],treatments:[treatment],tankPreparations:[],sites:[{id:'s1',organizationId:org}],...overrides})

test('Passport projects Product -> Lot -> Movement -> CostEntry plus MIPE source with frozen economics',()=>{
 const graph=buildInventoryPassport(state(),{organizationId:org,productId:'p1'})
 assert.deepEqual(graph.roots,['Product:p1'])
 assert.equal(graph.summary.products,1)
 assert.equal(graph.summary.lots,1)
 assert.equal(graph.summary.movements,1)
 assert.equal(graph.summary.costEntries,1)
 assert.equal(graph.summary.totalMovementCost,10)
 const edgeTypes=new Set(graph.edges.map(edge=>edge.type))
 assert.equal(edgeTypes.has('PRODUCT_HAS_LOT'),true)
 assert.equal(edgeTypes.has('LOT_HAS_MOVEMENT'),true)
 assert.equal(edgeTypes.has('MOVEMENT_BACKS_COST'),true)
 assert.equal(edgeTypes.has('MOVEMENT_EXECUTED_BY'),true)
 const movementNode=graph.nodes.find(node=>node.key==='InventoryMovement:m1')
 assert.equal(movementNode.unitCost,5)
 assert.equal(movementNode.cost,10)
})

test('current Product cost changes do not rewrite historical Passport economics',()=>{
 const graph=buildInventoryPassport(state({products:[{...product,cost:500}]}),{organizationId:org})
 assert.equal(graph.nodes.find(node=>node.key==='InventoryMovement:m1').unitCost,5)
 assert.equal(graph.summary.totalMovementCost,10)
 assert.equal(graph.nodes.find(node=>node.key==='CostEntry:c1').amount,10)
})

test('MIRFE aggregated CostEntry must be backed by the exact movement set',()=>{
 const m2={...movement,id:'m2',quantity:3,signedQuantity:-3,balanceBefore:8,balanceAfter:5,ledgerSequence:2,previousMovementId:'m1',unitCost:4,sourceType:'MirfePreparation',sourceId:'prep1'}
 const m3={...movement,id:'m3',lotId:'l2',productId:'p2',siteId:'s1',quantity:1,signedQuantity:-1,balanceBefore:5,balanceAfter:4,unit:'g',unitCost:7,sourceType:'MirfePreparation',sourceId:'prep1'}
 const p2={id:'p2',organizationId:org,name:'Nutrient',unit:'g'}
 const l2={id:'l2',organizationId:org,productId:'p2',siteId:'s1',quantity:4}
 const prep={id:'prep1',organizationId:org,siteId:'s1',status:'Ejecutada'}
 const aggregate={id:'cm',organizationId:org,module:'MIRFE',amount:19,sourceType:'MirfePreparation',sourceId:'prep1',inventoryMovementIds:['m2','m3']}
 const graph=buildInventoryPassport({products:[product,p2],inventoryLots:[lot,l2],inventoryMovements:[m2,m3],costEntries:[aggregate],treatments:[],tankPreparations:[prep],sites:[{id:'s1',organizationId:org}]},{organizationId:org})
 assert.equal(graph.summary.movements,2)
 assert.equal(graph.summary.costEntries,1)
 assert.equal(graph.nodes.find(node=>node.key==='CostEntry:cm').amount,19)
 assert.equal(graph.edges.filter(edge=>edge.type==='MOVEMENT_BACKS_COST').length,2)
})

test('Passport fails closed when Movement contradicts Lot -> Product causality',()=>{
 const p2={id:'p2',organizationId:org,name:'Other',unit:'mL'}
 const hostile={...movement,productId:'p2'}
 assert.throws(()=>buildInventoryPassport(state({products:[product,p2],inventoryMovements:[hostile]}),{organizationId:org}),/Movement contradice|Product raíz|causal/)
})

test('same IDs in another tenant never satisfy Inventory Passport references',()=>{
 const foreignProduct={...product,organizationId:'org-b'}
 const foreignLot={...lot,organizationId:'org-b'}
 const foreignMovement={...movement,organizationId:'org-b'}
 const foreignTreatment={...treatment,organizationId:'org-b'}
 const graph=buildInventoryPassport(state({products:[product,foreignProduct],inventoryLots:[lot,foreignLot],inventoryMovements:[movement,foreignMovement],treatments:[treatment,foreignTreatment]}),{organizationId:org})
 assert.equal(graph.nodes.filter(node=>node.type==='Product').length,1)
 assert.equal(graph.nodes.filter(node=>node.type==='InventoryLot').length,1)
 assert.equal(graph.nodes.filter(node=>node.type==='InventoryMovement').length,1)
})

test('tampered CostEntry amount fails against frozen movement economics',()=>{
 assert.throws(()=>buildInventoryPassport(state({costEntries:[{...cost,amount:11}]}),{organizationId:org}),/importe del CostEntry contradice/)
})

test('MIPE or MIRFE CostEntry with missing movement evidence fails closed',()=>{
 assert.throws(()=>buildInventoryPassport(state({costEntries:[{...cost,inventoryMovementId:'',inventoryMovementIds:[]}]}),{organizationId:org}),/requiere InventoryMovement explícito/)
})

test('unrelated non-inventory CostEntry without movement evidence stays outside Inventory Passport',()=>{
 const unrelated={id:'other-cost',organizationId:org,module:'POSTHARVEST',amount:500}
 const graph=buildInventoryPassport(state({costEntries:[cost,unrelated]}),{organizationId:org})
 assert.equal(graph.summary.costEntries,1)
 assert.equal(graph.nodes.some(node=>node.key==='CostEntry:other-cost'),false)
})

test('duplicate movement evidence fails closed',()=>{
 assert.throws(()=>buildInventoryPassport(state({costEntries:[{...cost,inventoryMovementIds:['m1','m1']}]}),{organizationId:org}),/duplicados/)
})

test('CostEntry cannot mix an out-of-subgraph or foreign movement reference',()=>{
 const foreign={...movement,id:'foreign-m',organizationId:'org-b'}
 const bad={...cost,inventoryMovementIds:['m1','foreign-m'],amount:20}
 assert.throws(()=>buildInventoryPassport(state({inventoryMovements:[movement,foreign],costEntries:[bad]}),{organizationId:org}),/fuera del subgrafo seleccionado/)
})

test('CostEntry source must agree with every backing Movement',()=>{
 const bad={...cost,sourceId:'other-treatment'}
 assert.throws(()=>buildInventoryPassport(state({costEntries:[bad]}),{organizationId:org}),/contradice la fuente operativa/)
})

test('operational Movement cannot project a missing MIPE or MIRFE source entity',()=>{
 assert.throws(()=>buildInventoryPassport(state({treatments:[]}),{organizationId:org}),/fuente operativa.*única referencia/)
})

test('Passport ordering is deterministic regardless of source array order',()=>{
 const first=buildInventoryPassport(state(),{organizationId:org})
 const second=buildInventoryPassport(state({products:[...state().products].reverse(),inventoryLots:[...state().inventoryLots].reverse(),inventoryMovements:[...state().inventoryMovements].reverse(),costEntries:[...state().costEntries].reverse()}),{organizationId:org})
 assert.deepEqual(first,second)
})
