const RECOVERY_KEY='nexora_document_inline_recovery_v1'
const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]

function fingerprint(value=''){
 let hash=2166136261
 for(let index=0;index<value.length;index++){hash^=value.charCodeAt(index);hash=Math.imul(hash,16777619)}
 return(hash>>>0).toString(16).padStart(8,'0')
}

function parse(raw,fallback){try{return raw?JSON.parse(raw):fallback}catch{return fallback}}
function defaultStorage(){return typeof localStorage==='undefined'?null:localStorage}

export function quarantineLegacyInlineDocuments(state={},storage=defaultStorage()){
 const attachments=list(state.attachments)
 const inline=attachments.filter(item=>typeof item?.dataUrl==='string'&&item.dataUrl.startsWith('data:'))
 const queuedInline=list(state.syncQueue).filter(item=>item?.collection==='attachments'&&typeof item?.payload?.dataUrl==='string'&&item.payload.dataUrl.startsWith('data:'))
 if(inline.length===0&&queuedInline.length===0)return state
 if(!storage)throw new Error('No existe almacenamiento de recuperación para preservar documentos inline legacy.')
 const previous=parse(storage.getItem(RECOVERY_KEY),{version:1,documents:[]})
 const recovered=new Map(list(previous.documents).map(item=>[`${item.id}|${item.fingerprint}`,item]))
 const preserve=(item,source)=>{
  const dataUrl=item?.dataUrl||item?.payload?.dataUrl||''
  const record=item?.payload||item
  const id=text(record?.id||item?.recordId||item?.id)||`legacy-${fingerprint(dataUrl)}`
  const mark=fingerprint(dataUrl)
  recovered.set(`${id}|${mark}`,{id,fingerprint:mark,source,name:text(record?.name),type:text(record?.type||record?.mimeType),size:Number(record?.size||0),entityType:text(record?.entityType),entityId:text(record?.entityId),organizationId:text(record?.organizationId||record?._organizationId||item?.companyId),preservedAt:new Date().toISOString(),dataUrl})
 }
 inline.forEach(item=>preserve(item,'state.attachments'))
 queuedInline.forEach(item=>preserve(item,'syncQueue.attachments'))
 storage.setItem(RECOVERY_KEY,JSON.stringify({version:1,updatedAt:new Date().toISOString(),documents:[...recovered.values()]}))
 const sanitizedAttachments=attachments.map(item=>{
  if(typeof item?.dataUrl!=='string'||!item.dataUrl.startsWith('data:'))return item
  const{dataUrl,...metadata}=item
  return{...metadata,legacyInlineQuarantined:true,migrationRequired:true,recoveryFingerprint:fingerprint(dataUrl)}
 })
 const sanitizedQueue=list(state.syncQueue).filter(item=>item?.collection!=='attachments')
 return{...state,attachments:sanitizedAttachments,syncQueue:sanitizedQueue}
}

export function readLegacyInlineDocumentRecovery(storage=defaultStorage()){
 if(!storage)return{version:1,documents:[]}
 return parse(storage.getItem(RECOVERY_KEY),{version:1,documents:[]})
}

export const legacyInlineDocumentRecoveryKey=RECOVERY_KEY
