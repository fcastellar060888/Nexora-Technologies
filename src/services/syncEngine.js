import{CANONICAL_IRRIGATION_COLLECTIONS}from'../domain/irrigationMirfeTenancy.js'

export const SYNCABLE_COLLECTIONS=[
 'sites','houses','beds','plantPositions','operationalAreas','infrastructureElements','infrastructureMovements','infrastructureAssets','assetMaintenances','environmentDevices','environmentCalibrations','environmentSetpoints','environmentalReadings','environmentAlerts',
 'genetics','incidents','findings','treatments','mipeInterventions','mipeCommandReceipts','plantEvents','grandmotherPlants','motherPlants','propagationBatches','propagationUnits','phaseTransitions','cultivationCycles','phaseTargets','lotEvents','cultivationTasks','propagationBanks','mapElements',
 'growingMediumProducts','growingMediumFormulas','growingMediumBatches','growingMediumAssignments','growingMediumReusePolicies','growingMediumReuseCycles','growingMediumPurchaseRequirements',
 ...CANONICAL_IRRIGATION_COLLECTIONS,
 'products','inventoryLots','inventoryMovements','finishedGoods','finishedGoodsMovements','sales','customers','currencies','mirfePrograms','mirfeMonitoring','mirfeReinforcements','waterAnalyses','nutrientProducts','nutrientObjectives','irrigationPlans','formulations','tankPreparations','workOrders','irrigationApplications','irrigationCorrections','irrigationHistory',
 'productionBatches','dryingBatches','trimmingBatches','selectionBatches','packingBatches','productionFlows','costEntries'
]

const APPEND_ONLY_SYNC_COLLECTIONS=new Set(['mipeCommandReceipts'])
const FIRST_CLASS_OWNERSHIP_SYNC_COLLECTIONS=new Set(['inventoryLots','inventoryMovements','currencies','costEntries'])
const OWNED_ONLY_SYNC_COLLECTIONS=new Set(['currencies','costEntries'])
const now=()=>new Date().toISOString()
const uid=()=>crypto.randomUUID()
const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const domainOrganizationId=record=>text(record?.organizationId||record?.companyId)
const recordOrganizationId=record=>domainOrganizationId(record)||text(record?._organizationId)
const recordId=record=>text(record?.id||record?.commandId)
const recordKey=record=>JSON.stringify([recordOrganizationId(record),recordId(record)])
const syncItems=(collection,items)=>OWNED_ONLY_SYNC_COLLECTIONS.has(collection)?list(items).filter(item=>recordOrganizationId(item)):list(items)

function assertCommandReceiptPayload(payload,recordIdValue,tenant){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('El receipt MIPE remoto requiere payload válido')
 const commandId=text(payload.commandId||payload.id),owner=recordOrganizationId(payload),signature=text(payload.signature)
 if(!commandId||commandId!==text(recordIdValue))throw new Error('El receipt MIPE no coincide con su commandId sincronizable')
 if(!text(payload.organizationId))throw new Error('El receipt MIPE sincronizable requiere organizationId explícito; un receipt legacy sin tenant debe migrarse antes de sync')
 if(owner!==tenant)throw new Error('El receipt MIPE pertenece a otra empresa')
 if(!signature)throw new Error('El receipt MIPE requiere firma durable')
 return{commandId,signature}
}
function assertRemoteReceiptIntegrity(state,records,tenant){
 const seen=new Map()
 for(const row of list(records).filter(item=>item?.collection==='mipeCommandReceipts')){
  if(row.deletedAt)throw new Error('Los receipts MIPE son append-only y no admiten tombstones remotos')
  const identity=text(row.recordId),validated=assertCommandReceiptPayload(row.payload,identity,tenant),key=`${tenant}|${identity}`
  if(seen.has(key)&&seen.get(key)!==validated.signature)throw new Error('La respuesta remota contiene receipts MIPE contradictorios')
  seen.set(key,validated.signature)
  const homonyms=list(state?.mipeCommandReceipts).filter(item=>text(item.commandId||item.id)===identity),legacy=homonyms.filter(item=>!recordOrganizationId(item)),existing=homonyms.filter(item=>recordOrganizationId(item)===tenant)
  if(legacy.length)throw new Error('El estado local contiene un receipt MIPE legacy sin tenant ambiguo; migra su organizationId antes de hidratar sync')
  if(existing.length>1)throw new Error('El estado local contiene receipts MIPE duplicados antes de hidratar sync')
  if(existing.length===1&&text(existing[0].signature)!==validated.signature)throw new Error('El receipt MIPE remoto contradice la firma durable local')
 }
}

export function collectionChanges(prev,next,collections=SYNCABLE_COLLECTIONS){
 const changes=[]
 for(const collection of collections){
  const beforeItems=syncItems(collection,prev?.[collection]),afterItems=syncItems(collection,next?.[collection])
  if([...beforeItems,...afterItems].some(item=>!recordId(item)))throw new Error(`${collection} contiene un registro sin identidad sincronizable.`)
  const before=new Map(beforeItems.map(item=>[recordKey(item),item]))
  const after=new Map(afterItems.map(item=>[recordKey(item),item]))
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
 const tenant=text(companyId),multiCompany=list(state?.companies).length>1
 const forbiddenDelete=list(changes).find(change=>APPEND_ONLY_SYNC_COLLECTIONS.has(change.collection)&&change.operation==='delete')
 if(forbiddenDelete)throw new Error(`${forbiddenDelete.collection} es append-only y no admite delete de sync`)
 const queued=changes.map(change=>{
  const requiresFirstClassOwner=FIRST_CLASS_OWNERSHIP_SYNC_COLLECTIONS.has(change.collection)
  const sourceRecord=change.operation==='upsert'?change.payload:change.previousPayload
  const domainOwner=domainOrganizationId(sourceRecord)
  const declaredOwner=text(change.organizationId)
  if(requiresFirstClassOwner&&!text(sourceRecord?.organizationId))throw new Error(`${change.collection} requiere organizationId explícito antes de sincronizar`)
  if(multiCompany&&!domainOwner)throw new Error(`${change.collection} requiere ownership de dominio explícito antes de sincronizar en multiempresa`)
  if(declaredOwner&&declaredOwner!==tenant)throw new Error('No se puede sincronizar un registro perteneciente a otra empresa')
  if(domainOwner&&domainOwner!==tenant)throw new Error('No se puede sincronizar un registro de dominio perteneciente a otra empresa')
  if(!text(change.recordId))throw new Error('No se puede sincronizar un registro sin identidad estable')
  let payload=change.payload
  if(change.operation==='upsert'){
   if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Una mutación upsert requiere payload de dominio válido')
   const owner=recordOrganizationId(payload)
   if(owner&&owner!==tenant)throw new Error('No se puede sincronizar un registro perteneciente a otra empresa')
   if(change.collection==='mipeCommandReceipts')assertCommandReceiptPayload(payload,change.recordId,tenant)
   payload={...payload,id:recordId(payload),organizationId:text(payload.organizationId)||domainOwner||tenant,_organizationId:tenant}
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
 const foreignPayload=list(records).find(row=>{const owner=domainOrganizationId(row.payload);return owner&&owner!==tenant})
 if(foreignPayload)throw new Error('No se puede hidratar un payload perteneciente a otra empresa')
 assertRemoteReceiptIntegrity(state,records,tenant)
 const next={...state},multiCompany=list(state?.companies).length>1
 for(const row of records){
  if(!SYNCABLE_COLLECTIONS.includes(row.collection))continue
  const items=list(next[row.collection]),remoteId=text(row.recordId)
  if(!remoteId)throw new Error('El registro remoto no tiene identidad estable')
  const receiptCollection=row.collection==='mipeCommandReceipts'
  const firstClassOwnershipCollection=FIRST_CLASS_OWNERSHIP_SYNC_COLLECTIONS.has(row.collection)
  const homonyms=items.filter(item=>recordId(item)===remoteId)
  if(firstClassOwnershipCollection){
   const legacy=homonyms.filter(item=>!recordOrganizationId(item))
   const owned=homonyms.filter(item=>recordOrganizationId(item)===tenant)
   if(legacy.length)throw new Error(`${row.collection} contiene un registro legacy sin organizationId; migra ownership antes de hidratar sync`)
   if(owned.length>1)throw new Error(`${row.collection} contiene identidades duplicadas dentro de la empresa activa`)
  }
  const isTenantRecord=item=>{
   if(recordId(item)!==remoteId)return false
   const owner=recordOrganizationId(item)
   if(receiptCollection||firstClassOwnershipCollection)return owner===tenant
   return owner===tenant||(!multiCompany&&!owner)
  }
  if(row.deletedAt){next[row.collection]=items.filter(item=>!isTenantRecord(item));continue}
  let record={...(row.payload||{}),id:row.recordId,organizationId:tenant,_organizationId:tenant,_syncVersion:Number(row.version||0),_updatedAt:row.updatedAt||''}
  if(receiptCollection)record={...record,commandId:row.recordId,organizationId:tenant}
  const index=items.findIndex(isTenantRecord)
  next[row.collection]=index<0?[...items,record]:items.map((item,i)=>i===index?record:item)
 }
 return next
}

export function syncStatus(state,companyId=state?.currentContext?.companyId||''){
 const tenant=text(companyId)
 if(!tenant)return{pending:0,failed:0,conflicts:0,lastSyncedAt:''}
 const queue=list(state.syncQueue).filter(item=>text(item?.companyId)===tenant)
 const conflicts=list(state.syncConflicts).filter(item=>text(item?.companyId)===tenant&&item.status!=='resolved')
 return{
  pending:queue.filter(x=>x.status==='pending').length,
  failed:queue.filter(x=>x.status==='failed').length,
  conflicts:conflicts.length,
  lastSyncedAt:state.syncMeta?.lastSyncedAt||''
 }
}
