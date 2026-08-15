import{useEffect,useRef,useState}from'react'
import{DomainEvents,publishDomainEvent}from'../core/events/index.js'
import{documentDownloadUrl,listDocuments,resolveDocumentScope,uploadDocument}from'../services/documentAuthority.js'
import{useStore}from'../services/store'

export default function AttachmentUploader({entityType,entityId,label='Adjuntar foto o documento',organizationId='',siteId=''}){
 const{state}=useStore()
 const[items,setItems]=useState([])
 const[message,setMessage]=useState({type:'',text:''})
 const[busy,setBusy]=useState(false)
 const memoryUrls=useRef(new Set())
 const contextCompany=state.currentContext?.companyId||''
 const contextSite=state.currentContext?.siteId||''

 useEffect(()=>{
  let active=true
  listDocuments({state,entityType,entityId,organizationId,siteId}).then(documents=>{if(active)setItems(current=>[...current.filter(item=>item.storageMode==='memory'),...documents])}).catch(error=>{if(active)setMessage({type:'error',text:error.message||'No fue posible cargar los documentos.'})})
  return()=>{active=false}
 },[entityType,entityId,organizationId,siteId,contextCompany,contextSite])

 useEffect(()=>()=>{for(const url of memoryUrls.current)URL.revokeObjectURL(url)},[])

 async function upload(e){
  const files=[...e.target.files]
  e.target.value=''
  if(files.length===0)return
  setBusy(true);setMessage({type:'',text:''})
  try{
   const scope=resolveDocumentScope(state,{organizationId,siteId})
   const created=[]
   for(const file of files){
    const documentId=crypto.randomUUID()
    await publishDomainEvent(state,{name:DomainEvents.DOCUMENT_UPLOAD_REQUESTED,aggregateType:'document',aggregateId:documentId,organizationId:scope.organizationId,siteId:scope.siteId,payload:{label:file.name,entityType,entityId,fileName:file.name,size:file.size,mimeType:file.type},metadata:{collections:[],commandId:documentId}})
    const document=await uploadDocument({state,file,entityType,entityId,organizationId:scope.organizationId,siteId:scope.siteId,documentId})
    if(document.storageMode==='memory'&&document.objectUrl)memoryUrls.current.add(document.objectUrl)
    await publishDomainEvent(state,{name:DomainEvents.DOCUMENT_ATTACHED,aggregateType:'document',aggregateId:document.id,organizationId:document.organizationId,siteId:document.siteId,payload:{label:document.name,entityType:document.entityType,entityId:document.entityId,fileName:document.name,mimeType:document.mimeType,size:document.size,checksum:document.checksum,storagePath:document.storagePath},metadata:{collections:[],commandId:document.id}})
    created.push(document)
   }
   setItems(current=>[...created,...current.filter(existing=>!created.some(document=>document.id===existing.id))])
   setMessage({type:'success',text:`${created.length} archivo${created.length===1?'':'s'} adjuntado${created.length===1?'':'s'} con trazabilidad.`})
  }catch(error){setMessage({type:'error',text:error.message||'No fue posible adjuntar el archivo.'})}
  finally{setBusy(false)}
 }

 async function openDocument(document){
  const tab=window.open('about:blank','_blank','noopener,noreferrer')
  try{
   const url=await documentDownloadUrl(document)
   if(tab)tab.location.href=url;else window.open(url,'_blank','noopener,noreferrer')
   if(document.storageMode!=='memory')setTimeout(()=>URL.revokeObjectURL(url),60000)
  }catch(error){if(tab)tab.close();setMessage({type:'error',text:error.message||'No fue posible abrir el documento.'})}
 }

 return <div className="attachment-box">
  <label className={`button secondary file-button${busy?' disabled':''}`}>{busy?'Subiendo…':label}<input type="file" accept="image/*,video/*,.pdf" multiple disabled={busy} onChange={upload}/></label>
  {message.text&&<p className={`validation-message ${message.type}`} role={message.type==='error'?'alert':'status'}>{message.text}</p>}
  <div className="attachment-grid">{items.map(document=><button type="button" className="attachment-document" key={document.id} onClick={()=>openDocument(document)}>{document.mimeType?.startsWith('image/')&&document.storageMode==='memory'?<img src={document.objectUrl} alt={document.name}/>:<span>{document.name}</span>}</button>)}</div>
 </div>
}
