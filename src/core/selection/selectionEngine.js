const normalizeId=value=>String(value??'').trim()
const uniqueIds=values=>Object.freeze([...new Set((Array.isArray(values)?values:[]).map(normalizeId).filter(Boolean))])

function requiredId(value,label){
 const normalized=normalizeId(value)
 if(!normalized)throw new Error(`${label} es obligatorio`)
 return normalized
}

export function createSelection({scopeType,scopeId,selectedIds=[]}){
 return Object.freeze({
  scopeType:requiredId(scopeType,'El tipo de alcance'),
  scopeId:requiredId(scopeId,'El alcance'),
  selectedIds:uniqueIds(selectedIds)
 })
}

export function isSelected(selection,id){
 return selection.selectedIds.includes(normalizeId(id))
}

export function selectOne(selection,id){
 return createSelection({...selection,selectedIds:[requiredId(id,'El identificador')]})
}

export function toggleSelection(selection,id){
 const targetId=requiredId(id,'El identificador')
 const selectedIds=isSelected(selection,targetId)
  ?selection.selectedIds.filter(value=>value!==targetId)
  :[...selection.selectedIds,targetId]
 return createSelection({...selection,selectedIds})
}

export function selectAll(selection,availableIds){
 return createSelection({...selection,selectedIds:availableIds})
}

export function clearSelection(selection){
 return createSelection({...selection,selectedIds:[]})
}

export function reconcileSelection(selection,availableIds){
 const available=new Set(uniqueIds(availableIds))
 return createSelection({...selection,selectedIds:selection.selectedIds.filter(id=>available.has(id))})
}

export function selectionSummary(selection,availableIds=[]){
 const available=uniqueIds(availableIds)
 const reconciled=reconcileSelection(selection,available)
 const selectedCount=reconciled.selectedIds.length
 return Object.freeze({
  selectedCount,
  availableCount:available.length,
  isEmpty:selectedCount===0,
  isAll:available.length>0&&selectedCount===available.length,
  isPartial:selectedCount>0&&selectedCount<available.length
 })
}

export function createBulkActionRequest({selection,actionType,availableIds,requiresConfirmation=true,metadata={}}){
 const reconciled=reconcileSelection(selection,availableIds)
 if(reconciled.selectedIds.length===0)throw new Error('Selecciona al menos un objeto para ejecutar la acción')
 if(metadata===null||Array.isArray(metadata)||typeof metadata!=='object')throw new Error('La metadata debe ser un objeto')
 return Object.freeze({
  actionType:requiredId(actionType,'El tipo de acción'),
  scopeType:reconciled.scopeType,
  scopeId:reconciled.scopeId,
  targetIds:reconciled.selectedIds,
  targetCount:reconciled.selectedIds.length,
  requiresConfirmation:Boolean(requiresConfirmation),
  metadata:Object.freeze(structuredClone(metadata))
 })
}
