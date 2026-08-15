export const SYNCABLE_COLLECTIONS=[
 'sites','houses','beds','plantPositions','operationalAreas','infrastructureElements','infrastructureMovements','infrastructureAssets','assetMaintenances','environmentalReadings',
 'genetics','incidents','findings','treatments','plantEvents','grandmotherPlants','motherPlants','propagationBatches','propagationUnits','phaseTransitions','cultivationCycles','phaseTargets','lotEvents','cultivationTasks','propagationBanks','mapElements',
 'growingMediumProducts','growingMediumFormulas','growingMediumBatches','growingMediumAssignments','growingMediumReusePolicies','growingMediumReuseCycles','growingMediumPurchaseRequirements',
 'products','inventoryLots','inventoryMovements','finishedGoods','finishedGoodsMovements','sales','customers','mirfePrograms','mirfeMonitoring','mirfeReinforcements','waterAnalyses','nutrientProducts','nutrientObjectives','irrigationPlans','formulations','tankPreparations','workOrders','irrigationApplications','irrigationCorrections','irrigationHistory',
 'productionBatches','dryingBatches','trimmingBatches','selectionBatches','packingBatches','productionFlows','costEntries'
]

const now=()=>new Date().toISOString()
const uid=()=>crypto.randomUUID()
const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const recordOrganizationId=record=>text(record?.organizationId||record?.companyId||record?._organizationId)

export function collectionChanges(prev,next,collections=SYNCABLE_COLLECTIONS){
 const changes=[]
 for(const collection of collections){
  const before=new Map(list(prev?.[collection]).map(item=>[item.id,item]))
  const after=new Map(list(next?.[collection]).map(item=>[item.id,item]))
  for(const [id,item] of after){
   const old=before.get(id)
   if(!old||JSON.stringify(old)!==JSON.stringify(item))changes.push({collection,recordId:id,operation:'upsert',payload:item})
  }
  for(const id of before.keys())if(!after.has(id))changes.push({collection,recordId:id,operation:'delete',payload:null})
 }
 return changes
}

export function enqueueChanges(state,changes,{companyId,userId,deviceId}={}){
 if(!companyId||changes.length===0)return state
 const queue=[...(state.syncQueue||[])],timestamp=now()
 for(const change of changes){
  const payloadOrganizationId=change.operation==='delete'?'':recordOrganizationId(change.payload)
  if(change.operation!=='delete'&&payloadOrganizationId&&payloadOrganizationId!==companyId)throw new Error(`La mutación ${change.collection}/${change.recordId} pertenece a otra organización.`)
  const payload=change.operation==='delete'?null:{...change.payload,_organizationId:companyId}
  queue.push({id:uid(),companyId,userId:userId||'',deviceId:deviceId||'',collection:change.collection,recordId:change.recordId,operation:change.operation,payload,baseVersion:0,createdAt:timestamp,attempts:0,status:'pending',error:''})
 }
 return{...state,syncQueue:queue}
}

export function pendingForCompany(state,companyId){return list(state.syncQueue).filter(item=>item.companyId===companyId&&item.status==='pending')}

export function markSyncAttempt(state,ids,error=''){
 const target=new Set(ids),timestamp=now()
 return{...state,syncQueue:list(state.syncQueue).map(item=>target.has(item.id)?{...item,attempts:Number(item.attempts||0)+1,lastAttemptAt:timestamp,error}:item)}
}

export function markSyncCompleted(state,ids){const done=new Set(ids);return{...state,syncQueue:list(state.syncQueue).filter(item=>!done.has(item.id)),syncMeta:{...(state.syncMeta||{}),lastSyncedAt:now()}}}

export function registerSyncConflict(state,conflict){return{...state,syncConflicts:[...list(state.syncConflicts),{id:uid(),createdAt:now(),status:'open',...conflict}]}}

export function resolveSyncConflict(state,conflictId,resolution){return{...state,syncConflicts:list(state.syncConflicts).map(item=>item.id===conflictId?{...item,status:'resolved',resolution,resolvedAt:now()}:item)}}
