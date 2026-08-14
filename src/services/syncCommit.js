import{overlayConcurrentChanges}from'./remoteBootstrap.js'

const list=value=>Array.isArray(value)?value:[]

function mergeById(processed=[],current=[],initial=[]){
 const initialIds=new Set(list(initial).map(item=>item?.id).filter(Boolean))
 const merged=new Map(list(processed).map(item=>[item?.id,item]).filter(([id])=>id))
 for(const item of list(current)){
  if(!item?.id)continue
  if(!initialIds.has(item.id))merged.set(item.id,item)
 }
 return[...merged.values()]
}

function mergeLedgerOutbox(initialState,currentState,processedState){
 const initial=initialState?.syncMeta?.ledgerOutboxByCompany||{}
 const current=currentState?.syncMeta?.ledgerOutboxByCompany||{}
 const processed=processedState?.syncMeta?.ledgerOutboxByCompany||{}
 const companies=new Set([...Object.keys(initial),...Object.keys(current),...Object.keys(processed)])
 const result={}
 for(const companyId of companies){
  const initialSet=new Set(list(initial[companyId]))
  const retained=new Set(list(processed[companyId]))
  for(const eventId of list(current[companyId]))if(!initialSet.has(eventId))retained.add(eventId)
  result[companyId]=[...retained]
 }
 return result
}

function mergeSyncMeta(initialState,currentState,processedState){
 const current=currentState?.syncMeta||{}
 const processed=processedState?.syncMeta||{}
 return{
  ...current,
  ...processed,
  ledgerCursorByCompany:{...(current.ledgerCursorByCompany||{}),...(processed.ledgerCursorByCompany||{})},
  ledgerOutboxByCompany:mergeLedgerOutbox(initialState,currentState,processedState)
 }
}

export function commitIncrementalSyncResult(initialState,currentState,processedState){
 const startedFor=initialState?.currentContext?.companyId||''
 const activeNow=currentState?.currentContext?.companyId||''
 const processedFor=processedState?.currentContext?.companyId||startedFor
 if(!startedFor||startedFor!==activeNow||processedFor!==startedFor)return currentState
 const concurrent=overlayConcurrentChanges(initialState,currentState,processedState)
 return{
  ...concurrent,
  currentContext:currentState.currentContext,
  companies:list(currentState.companies),
  users:list(currentState.users),
  roles:list(currentState.roles),
  memberships:list(currentState.memberships),
  userSessions:list(currentState.userSessions),
  auditLog:list(currentState.auditLog),
  timelineEntries:mergeById(processedState.timelineEntries,currentState.timelineEntries,initialState.timelineEntries),
  operationalLedgerEntries:mergeById(processedState.operationalLedgerEntries,currentState.operationalLedgerEntries,initialState.operationalLedgerEntries),
  syncQueue:mergeById(processedState.syncQueue,currentState.syncQueue,initialState.syncQueue),
  syncConflicts:mergeById(processedState.syncConflicts,currentState.syncConflicts,initialState.syncConflicts),
  syncHealthEvents:list(currentState.syncHealthEvents),
  syncDeviceHealth:list(currentState.syncDeviceHealth),
  syncMeta:mergeSyncMeta(initialState,currentState,processedState)
 }
}
