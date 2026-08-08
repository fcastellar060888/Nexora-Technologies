import{authenticatedRequest}from'./supabase.js'

const PULL_PAGE_SIZE=1000
const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const sequence=value=>{
 const number=Number(value)
 if(!Number.isSafeInteger(number)||number<1)throw new Error('La secuencia remota del Operational Ledger no es válida')
 return number
}
const entryOrganizationId=entry=>text(entry?.event?.context?.organizationId)
const eventIdOf=entry=>text(entry?.event?.eventId||entry?.id)
const uniqueIds=value=>[...new Set(list(value).map(text).filter(Boolean))]

export function operationalLedgerCursor(state,companyId=state?.currentContext?.companyId||''){
 const value=Number(state?.syncMeta?.ledgerCursorByCompany?.[companyId]||0)
 return Number.isSafeInteger(value)&&value>=0?value:0
}

export function operationalLedgerOutbox(state,companyId=state?.currentContext?.companyId||''){
 if(!companyId)return[]
 return uniqueIds(state?.syncMeta?.ledgerOutboxByCompany?.[companyId])
}

export function pendingOperationalLedgerEntries(state,companyId=state?.currentContext?.companyId||''){
 if(!companyId)return[]
 const byId=new Map(
  list(state?.operationalLedgerEntries)
   .filter(entry=>entryOrganizationId(entry)===companyId)
   .map(entry=>[eventIdOf(entry),entry])
 )
 return operationalLedgerOutbox(state,companyId).map(id=>{
  const entry=byId.get(id)
  if(!entry)throw new Error(`La outbox del Operational Ledger referencia un evento local inexistente: ${id}`)
  return entry
 })
}

export function buildOperationalLedgerPullPath(companyId,cursor=0,{limit=PULL_PAGE_SIZE}={}){
 if(!companyId)throw new Error('Se requiere empresa para consultar el Operational Ledger')
 if(!Number.isSafeInteger(Number(cursor))||Number(cursor)<0)throw new Error('El cursor del Operational Ledger no es válido')
 const params=new URLSearchParams()
 params.set('organization_id',`eq.${companyId}`)
 params.set('sequence',`gt.${Number(cursor)}`)
 params.set('select','organization_id,sequence,event_id,event,recorded_at')
 params.set('order','sequence.asc')
 params.set('limit',String(limit))
 return`/rest/v1/operational_ledger_events?${params.toString()}`
}

export function mapOperationalLedgerRow(row,companyId){
 if(text(row?.organization_id)!==text(companyId))throw new Error('El Operational Ledger remoto contiene datos de otra empresa')
 const event=row?.event
 if(!event||typeof event!=='object'||Array.isArray(event))throw new Error('El Operational Ledger remoto contiene un evento inválido')
 if(text(event?.context?.organizationId)!==text(companyId))throw new Error('El evento remoto no pertenece a la empresa solicitada')
 const id=text(row?.event_id||event?.eventId)
 if(!id||id!==text(event?.eventId))throw new Error('La identidad remota del evento no es válida')
 const recordedAt=text(row?.recorded_at)
 if(Number.isNaN(Date.parse(recordedAt)))throw new Error('La fecha remota del Operational Ledger no es válida')
 return Object.freeze({id,sequence:sequence(row.sequence),recordedAt:new Date(recordedAt).toISOString(),event})
}

function canonicalEntryFromAppend(entry,row,companyId){
 const result=Array.isArray(row)?row[0]:row
 const id=eventIdOf(entry)
 if(!id||entryOrganizationId(entry)!==companyId)throw new Error('La entrada local del Operational Ledger no pertenece a la empresa activa')
 const recordedAt=text(result?.recorded_at)
 if(Number.isNaN(Date.parse(recordedAt)))throw new Error('La confirmación remota del Operational Ledger no contiene recorded_at válido')
 return Object.freeze({id,sequence:sequence(result?.sequence),recordedAt:new Date(recordedAt).toISOString(),event:entry.event})
}

async function appendRemoteEntry(request,entry,companyId){
 const result=await request('/rest/v1/rpc/append_operational_ledger_event',{
  method:'POST',
  body:{p_organization_id:companyId,p_event:entry.event}
 })
 return canonicalEntryFromAppend(entry,result,companyId)
}

async function pullRemoteEntries(request,companyId,cursor){
 const entries=[]
 let pageCursor=cursor
 while(true){
  const rows=list(await request(buildOperationalLedgerPullPath(companyId,pageCursor)))
  const mapped=rows.map(row=>mapOperationalLedgerRow(row,companyId))
  for(const entry of mapped){
   if(entry.sequence<=pageCursor)throw new Error('El Operational Ledger remoto no avanzó el cursor de forma estricta')
   entries.push(entry)
   pageCursor=entry.sequence
  }
  if(rows.length<PULL_PAGE_SIZE)break
 }
 return entries
}

export function mergeOperationalLedgerPartition(existing,incoming,companyId,{replaceCurrent=false}={}){
 const foreign=list(existing).filter(entry=>entryOrganizationId(entry)!==companyId)
 const current=new Map()
 if(!replaceCurrent){
  for(const entry of list(existing))if(entryOrganizationId(entry)===companyId)current.set(eventIdOf(entry),entry)
 }
 for(const entry of list(incoming)){
  if(entryOrganizationId(entry)!==companyId)throw new Error('No se puede reconciliar una entrada del Ledger de otra empresa')
  const id=eventIdOf(entry)
  if(!id)throw new Error('La entrada del Operational Ledger requiere eventId')
  current.set(id,entry)
 }
 const ordered=[...current.values()].sort((a,b)=>Number(a.sequence)-Number(b.sequence)||eventIdOf(a).localeCompare(eventIdOf(b)))
 const bySequence=new Map()
 for(const entry of ordered){
  const owner=bySequence.get(Number(entry.sequence))
  if(owner&&owner!==eventIdOf(entry))throw new Error(`Colisión de secuencia ${entry.sequence} entre eventos ${owner} y ${eventIdOf(entry)}`)
  bySequence.set(Number(entry.sequence),eventIdOf(entry))
 }
 return[...foreign,...ordered]
}

export async function synchronizeOperationalLedger(state,{companyId=state?.currentContext?.companyId||'',request=authenticatedRequest}={}){
 if(!companyId)throw new Error('Selecciona una empresa antes de sincronizar el Operational Ledger')
 if(state?.currentContext?.companyId&&state.currentContext.companyId!==companyId)throw new Error('La empresa del Operational Ledger no coincide con el contexto activo')
 const cursor=operationalLedgerCursor(state,companyId)
 const pending=pendingOperationalLedgerEntries(state,companyId)
 const confirmed=[]
 for(const entry of pending)confirmed.push(await appendRemoteEntry(request,entry,companyId))

 const pulled=await pullRemoteEntries(request,companyId,cursor)
 const incoming=[...confirmed,...pulled]
 const merged=mergeOperationalLedgerPartition(state?.operationalLedgerEntries,incoming,companyId,{replaceCurrent:cursor===0})
 const nextCursor=incoming.reduce((value,entry)=>Math.max(value,entry.sequence),cursor)
 const confirmedIds=new Set(confirmed.map(eventIdOf))
 const remainingOutbox=operationalLedgerOutbox(state,companyId).filter(id=>!confirmedIds.has(id))
 return{
  state:{
   ...state,
   operationalLedgerEntries:merged,
   syncMeta:{
    ...(state?.syncMeta||{}),
    ledgerCursorByCompany:{...(state?.syncMeta?.ledgerCursorByCompany||{}),[companyId]:nextCursor},
    ledgerOutboxByCompany:{...(state?.syncMeta?.ledgerOutboxByCompany||{}),[companyId]:remainingOutbox}
   }
  },
  pushed:pending.length,
  pulled:pulled.length,
  cursor:nextCursor
 }
}
