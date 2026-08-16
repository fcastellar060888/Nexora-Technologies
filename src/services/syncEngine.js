export const SYNCABLE_COLLECTIONS=[
 'sites','houses','beds','plantPositions','operationalAreas','infrastructureElements','infrastructureMovements','infrastructureAssets','assetMaintenances','environmentDevices','environmentCalibrations','environmentSetpoints','environmentalReadings','environmentAlerts',
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
const recordId=record=>text(record?.id)
const recordKey=record=>JSON.stringify([recordOrganizationId(record),recordId(record)])

export function collectionChanges(prev,next,collections=SYNCABLE_COLLECTIONS){
 const changes=[]
 for(const collection of collections){
  const before=new Map(list(prev?.[collection]).map(item=>[recordKey(item),item]))
  const after=new Map(list(next?.[collection]).map(item=>[recordKey(item),item]))
  for(const [key,item] of after){
   const old=before.get(key)
   if(!old||JSON.stringify(old)!==JSON.stringify(item))changes.push({collection,recordId:recordId(item),organizationId:recordOrganizationId(item),operation:'upsert',payload:item,previousPayload:old||null})
  }
  for(const [key,item] of before)if(!after.has(key))changes.push({collection,recordId:recordId(item),organizationId:recordOrganizationId(item),operation:'delete',payload:null,previousPayload:item})
 }
 return changes
}

export function enqueueChanges(state,changes,{companyId,userId,deviceId}={}){
 if(!companyId||changes.length===0)return state
 const tenant=text(companyId)
 const queued=changes.map(change=>{
  const declaredOwner=text(change.organizationId)
  if(declaredOwner&&declaredOwner!==tenant)throw new Error('No se puede sincronizar un registro perteneciente a otra empresa')
  let payload=change.payload
  if(change.operation==='upsert'){
   if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Una mutación upsert requiere payload de dominio válido')
   const owner=recordOrganizationId(payload)
   if(owner&&owner!==tenant)throw new Error('No se puede sincronizar un registro perteneciente a otra empresa')
   payload={...payload,_organizationId:tenant}
  }
  return{
   id:uid(),companyId:tenant,userId:userId||'',deviceId:deviceId||'',
   collection:change.collection,recordId:change.recordId,operation:change.operation,payload,
   baseVersion:Number(payload?._syncVersion||0),status:'pending',attempts:0,createdAt:now(),updatedAt:now(),error:''
  }
 })
 return{...state,syncQueue:[...list(state.syncQueue),...queued]}
}

export function compactQueue(queue=[]){
 const map=new Map()
 for(const entry of list(queue)){
  if(entry.status==='completed')continue
  map.set(`${entry.companyId}|${entry.collection}|${entry.recordId}`,entry)
 }
 return[...map.values()]
}

export function resolveConflict({local,remote,strategy='remote'}){
 if(strategy==='local')return{winner:'local',record:local}
 if(strategy==='newest'){
  const localAt=Date.parse(local?.updatedAt||local?._updatedAt||0)||0
  const remoteAt=Date.parse(remote?.updatedAt||remote?._updatedAt||0)||0
  return remoteAt>=localAt?{winner:'remote',record:remote}:{winner:'local',record:local}
 }
 return{winner:'remote',record:remote}
}

export function applyRemoteRecords(state,records=[],{companyId=state.currentContext?.companyId||''}={}){
 const tenant=text(companyId)
 if(!tenant)throw new Error('Se requiere empresa activa para aplicar registros remotos')
 const foreign=list(records).filter(row=>text(row.companyId)!==tenant)
 if(foreign.length)throw new Error('No se pueden aplicar registros remotos de otra empresa')
 const foreignPayload=list(records).find(row=>{const owner=recordOrganizationId(row.payload);return owner&&owner!==tenant})
 if(foreignPayload)throw new Error('No se puede hidratar un payload perteneciente a otra empresa')
 const next={...state}
 for(const row of records){
  if(!SYNCABLE_COLLECTIONS.includes(row.collection))continue
  const items=list(next[row.collection]),remoteId=text(row.recordId)
  const isTenantRecord=item=>recordId(item)===remoteId&&(!recordOrganizationId(item)||recordOrganizationId(item)===tenant)
  if(row.deletedAt){next[row.collection]=items.filter(item=>!isTenantRecord(item));continue}
  const record={...(row.payload||{}),id:row.recordId,_organizationId:tenant,_syncVersion:Number(row.version||0),_updatedAt:row.updatedAt||''}
  const index=items.findIndex(isTenantRecord)
  next[row.collection]=index<0?[...items,record]:items.map((item,i)=>i===index?record:item)
 }
 return next
}

export function syncStatus(state){
 const queue=list(state.syncQueue)
 return{
  pending:queue.filter(x=>x.status==='pending').length,
  failed:queue.filter(x=>x.status==='failed').length,
  conflicts:list(state.syncConflicts).filter(x=>x.status!=='resolved').length,
  lastSyncedAt:state.syncMeta?.lastSyncedAt||''
 }
}
