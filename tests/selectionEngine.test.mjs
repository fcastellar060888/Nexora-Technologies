import test from'node:test'
import assert from'node:assert/strict'
import{
 createSelection,
 selectOne,
 toggleSelection,
 selectAll,
 clearSelection,
 reconcileSelection,
 selectionSummary,
 createBulkActionRequest
}from'../src/core/selection/index.js'

test('supports individual multiple and total selection without duplicates',()=>{
 const initial=createSelection({scopeType:'cultivation.map',scopeId:'house-1'})
 const one=selectOne(initial,'plant-1')
 assert.deepEqual(one.selectedIds,['plant-1'])
 const multiple=toggleSelection(one,'plant-2')
 assert.deepEqual(multiple.selectedIds,['plant-1','plant-2'])
 const total=selectAll(multiple,['plant-1','plant-2','plant-2','plant-3'])
 assert.deepEqual(total.selectedIds,['plant-1','plant-2','plant-3'])
 assert.deepEqual(selectionSummary(total,['plant-1','plant-2','plant-3']),{
  selectedCount:3,availableCount:3,isEmpty:false,isAll:true,isPartial:false
 })
})

test('reconciles stale ids and clears safely',()=>{
 const selection=createSelection({scopeType:'plant',scopeId:'site-1',selectedIds:['plant-1','removed']})
 const reconciled=reconcileSelection(selection,['plant-1','plant-2'])
 assert.deepEqual(reconciled.selectedIds,['plant-1'])
 assert.equal(selectionSummary(reconciled,['plant-1','plant-2']).isPartial,true)
 assert.deepEqual(clearSelection(reconciled).selectedIds,[])
})

test('bulk action request only includes available targets and requires an explicit selection',()=>{
 const selection=createSelection({scopeType:'plant',scopeId:'house-1',selectedIds:['plant-1','stale']})
 const request=createBulkActionRequest({
  selection,
  actionType:'plant.add_observation',
  availableIds:['plant-1','plant-2'],
  metadata:{source:'unified-map'}
 })
 assert.deepEqual(request.targetIds,['plant-1'])
 assert.equal(request.targetCount,1)
 assert.equal(request.requiresConfirmation,true)
 assert.throws(()=>createBulkActionRequest({
  selection:createSelection({scopeType:'plant',scopeId:'house-1'}),
  actionType:'plant.archive',
  availableIds:['plant-1']
 }),/Selecciona al menos un objeto/)
})
