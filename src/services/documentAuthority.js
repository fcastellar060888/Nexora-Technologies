import{authenticatedBinaryRequest,authenticatedRequest,supabaseEnabled}from'./supabase.js'

export const DOCUMENT_BUCKET='documents'
export const MAX_DOCUMENT_BYTES=25*1024*1024
export const DOCUMENT_STATUS=Object.freeze({ACTIVE:'active',ARCHIVED:'archived'})
const ALLOWED_EXACT=new Set(['application/pdf'])
const text=value=>String(value??'').trim()
const safeSegment=value=>text(value).normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'unknown'
const hex=buffer=>[...new Uint8Array(buffer)].map(byte=>byte.toString(16).padStart(2,'0')).join('')

export function isAllowedDocumentType(type=''){
 const mime=text(type).toLowerCase()
 return mime.startsWith('image/')||mime.startsWith('video/')||ALLOWED_EXACT.has(mime)
}

export function validateDocumentFile(file){
 if(!file||typeof file.arrayBuffer!=='function')throw new TypeError('Selecciona un archivo válido.')
 if(!text(file.name))throw new Error('El archivo necesita nombre.')
 if(!isAllowedDocumentType(file.type))throw new Error('Tipo de archivo no permitido. Usa imagen, video o PDF.')
 const size=Number(file.size||0)
 if(size<=0)throw new Error('El archivo está vacío.')
 if(size>MAX_DOCUMENT_BYTES)throw new Error('El archivo supera el límite de 25 MB.')
 return file
}

export function resolveDocumentScope(state,{organizationId='',siteId=''}={}){
 const requestedOrg=text(organizationId),contextOrg=text(state?.currentContext?.companyId),requestedSite=text(siteId||state?.currentContext?.siteId)
 const site=requestedSite?(state?.sites||[]).find(item=>item.id===requestedSite):null
 const siteOrg=text(site?.companyId||site?.organizationId)
 const organization=text(requestedOrg||siteOrg||contextOrg)
 if(!organization){
  if((state?.companies||[]).length===0&&(state?.memberships||[]).length===0)return{organizationId:'local-installation',siteId:requestedSite||null}
  throw new Error('No se puede demostrar la organización del documento.')
 }
 if(siteOrg&&siteOrg!==organization)throw new Error('La sede del documento pertenece a otra organización.')
 if(requestedOrg&&contextOrg&&requestedOrg!==contextOrg)throw new Error('No se puede adjuntar un documento a otra organización.')
 return{organizationId:organization,siteId:requestedSite||null}
}

export async function sha256Document(file){
 validateDocumentFile(file)
 if(!globalThis.crypto?.subtle)throw new Error('SHA-256 no está disponible en este entorno.')
 return hex(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))
}

export function documentStoragePath({organizationId,siteId,entityType,entityId,documentId,fileName}){
 const organization=safeSegment(organizationId)
 if(!organization||organization==='unknown')throw new Error('organizationId es obligatorio para la ruta documental.')
 return[organization,safeSegment(siteId||'_global'),safeSegment(entityType),safeSegment(entityId),safeSegment(documentId),safeSegment(fileName)].join('/')
}

export function mapRemoteDocument(row={}){
 return Object.freeze({id:text(row.id),organizationId:text(row.organization_id||row.organizationId),siteId:text(row.site_id||row.siteId)||null,entityType:text(row.entity_type||row.entityType),entityId:text(row.entity_id||row.entityId),name:text(row.name),mimeType:text(row.mime_type||row.mimeType),size:Number(row.size_bytes??row.size??0),checksum:text(row.checksum_sha256||row.checksum),storageBucket:text(row.storage_bucket||row.storageBucket||DOCUMENT_BUCKET),storagePath:text(row.storage_path||row.storagePath),status:text(row.status||DOCUMENT_STATUS.ACTIVE),createdAt:text(row.created_at||row.createdAt),createdBy:text(row.created_by||row.createdBy),archivedAt:text(row.archived_at||row.archivedAt)||null,storageMode:'supabase'})
}

export async function uploadDocument({state,file,entityType,entityId,organizationId='',siteId='',documentId=crypto.randomUUID()},{binaryRequest=authenticatedBinaryRequest,jsonRequest=authenticatedRequest,enabled=supabaseEnabled}={}){
 validateDocumentFile(file)
 const scope=resolveDocumentScope(state,{organizationId,siteId})
 const id=text(documentId);if(!id)throw new Error('documentId es obligatorio.')
 const checksum=await sha256Document(file)
 const storagePath=documentStoragePath({...scope,entityType,entityId,documentId:id,fileName:file.name})
 const base={id,organizationId:scope.organizationId,siteId:scope.siteId,entityType:text(entityType),entityId:text(entityId),name:text(file.name),mimeType:text(file.type),size:Number(file.size),checksum,storageBucket:DOCUMENT_BUCKET,storagePath,status:DOCUMENT_STATUS.ACTIVE}
 if(!base.entityType||!base.entityId)throw new Error('El documento necesita una entidad de destino.')
 if(!enabled){
  const objectUrl=URL.createObjectURL(file)
  return Object.freeze({...base,createdAt:new Date().toISOString(),createdBy:'local-installation',storageMode:'memory',objectUrl})
 }
 const objectPath=storagePath.split('/').map(encodeURIComponent).join('/')
 await binaryRequest(`/storage/v1/object/${DOCUMENT_BUCKET}/${objectPath}`,{method:'POST',body:file,contentType:file.type,headers:{'x-upsert':'false'}})
 try{
  const rows=await jsonRequest('/rest/v1/documents',{method:'POST',headers:{Prefer:'return=representation'},body:{id,organization_id:scope.organizationId,site_id:scope.siteId,entity_type:base.entityType,entity_id:base.entityId,name:base.name,mime_type:base.mimeType,size_bytes:base.size,checksum_sha256:checksum,storage_bucket:DOCUMENT_BUCKET,storage_path:storagePath,status:DOCUMENT_STATUS.ACTIVE}})
  return mapRemoteDocument(rows?.[0]||{...base,organization_id:scope.organizationId,site_id:scope.siteId,entity_type:base.entityType,entity_id:base.entityId,mime_type:base.mimeType,size_bytes:base.size,checksum_sha256:checksum,storage_bucket:DOCUMENT_BUCKET,storage_path:storagePath})
 }catch(error){
  await binaryRequest(`/storage/v1/object/${DOCUMENT_BUCKET}/${objectPath}`,{method:'DELETE',body:undefined,contentType:'application/octet-stream'}).catch(()=>{})
  throw error
 }
}

export async function listDocuments({state,entityType,entityId,organizationId='',siteId=''},{jsonRequest=authenticatedRequest,enabled=supabaseEnabled}={}){
 const scope=resolveDocumentScope(state,{organizationId,siteId})
 if(!enabled)return[]
 const query=new URLSearchParams({organization_id:`eq.${scope.organizationId}`,entity_type:`eq.${text(entityType)}`,entity_id:`eq.${text(entityId)}`,status:`eq.${DOCUMENT_STATUS.ACTIVE}`,select:'*',order:'created_at.desc'})
 const rows=await jsonRequest(`/rest/v1/documents?${query.toString()}`)
 return(rows||[]).map(mapRemoteDocument).filter(item=>item.organizationId===scope.organizationId&&item.entityType===text(entityType)&&item.entityId===text(entityId))
}

export async function documentDownloadUrl(document,{binaryRequest=authenticatedBinaryRequest}={}){
 if(document?.storageMode==='memory')return document.objectUrl||''
 const objectPath=text(document?.storagePath).split('/').map(encodeURIComponent).join('/')
 const blob=await binaryRequest(`/storage/v1/object/${text(document?.storageBucket||DOCUMENT_BUCKET)}/${objectPath}`,{method:'GET'})
 return URL.createObjectURL(blob)
}
