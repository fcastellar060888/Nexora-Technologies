import{useStore}from'../services/store'
export default function AttachmentUploader({entityType,entityId,label='Adjuntar foto o documento'}){
 const{state,update}=useStore()
 function upload(e){
  const files=[...e.target.files]
  files.forEach(file=>{
   const reader=new FileReader()
   reader.onload=()=>update(s=>({...s,attachments:[...s.attachments,{id:crypto.randomUUID(),entityType,entityId,name:file.name,type:file.type,size:file.size,dataUrl:reader.result,createdAt:new Date().toISOString()}]}),{module:'Adjuntos',action:'Archivo adjuntado',detail:file.name})
   reader.readAsDataURL(file)
  })
 }
 const items=state.attachments.filter(x=>x.entityType===entityType&&x.entityId===entityId)
 return <div className="attachment-box"><label className="button secondary file-button">{label}<input type="file" accept="image/*,video/*,.pdf" multiple onChange={upload}/></label><div className="attachment-grid">{items.map(x=><a key={x.id} href={x.dataUrl} target="_blank" rel="noreferrer">{x.type?.startsWith('image/')?<img src={x.dataUrl} alt={x.name}/>:<span>{x.name}</span>}</a>)}</div></div>
}
