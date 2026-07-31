import{createContext,useCallback,useContext,useEffect,useMemo,useRef,useState}from'react'
import{useStore}from'./store.jsx'
import{createRealtimePresence}from'./realtimePresence.js'

const RealtimeContext=createContext(null)
const REFRESH_DELAY_MS=450
const EDITOR_TTL_MS=45000

function formDescriptor(target){
 const form=target?.closest?.('form')
 const dialog=target?.closest?.('[role="dialog"],.modal')
 const heading=(dialog||form||document)?.querySelector?.('h1,h2,h3,h4,.card-heading strong,.modal-head strong')?.textContent?.trim()
 return{
  path:window.location.pathname,
  formId:form?.id||form?.dataset?.formId||'',
  label:form?.dataset?.module||heading||document.title||'Formulario'
 }
}

export function RealtimeProvider({children}){
 const{state,hydrateFromPostgres}=useStore()
 const clientRef=useRef(null)
 const refreshRef=useRef(null)
 const blurRef=useRef(null)
 const[presence,setPresence]=useState([])
 const[editors,setEditors]=useState([])
 const[lastEvent,setLastEvent]=useState(null)
 const[runtime,setRuntime]=useState({status:'idle',error:'',organizationId:'',attempt:0})
 const companyId=state.currentContext?.companyId||''
 const actor=(state.users||[]).find(user=>user.activeSession)||{}
 const actorId=actor.remoteId||actor.id||''

 const refreshRemote=useCallback(payload=>{
  if(!companyId||payload?.organizationId&&payload.organizationId!==companyId)return
  clearTimeout(refreshRef.current)
  refreshRef.current=setTimeout(()=>hydrateFromPostgres(companyId,{force:true,reason:'realtime-event'}),REFRESH_DELAY_MS)
 },[companyId,hydrateFromPostgres])

 const applyEditorEvent=useCallback((event,payload)=>{
  if(!payload?.actorId||payload.actorId===actorId)return
  setEditors(current=>{
   const active=current.filter(item=>item.actorId!==payload.actorId&&Date.now()-new Date(item.updatedAt).getTime()<EDITOR_TTL_MS)
   if(event==='editor-stop')return active
   return[...active,{...payload,updatedAt:new Date().toISOString()}]
  })
 },[actorId])

 useEffect(()=>{
  clientRef.current?.destroy()
  clientRef.current=null
  clearTimeout(refreshRef.current)
  setPresence([])
  setEditors([])
  if(!companyId){setRuntime({status:'idle',error:'',organizationId:'',attempt:0});return}
  clientRef.current=createRealtimePresence({
   organizationId:companyId,
   user:{id:actorId,name:actor.name||'',email:actor.email||''},
   onStatus:setRuntime,
   onPresence:setPresence,
   onEvent:event=>{
    setLastEvent({...event,receivedAt:new Date().toISOString()})
    if(event.type==='operational-change'&&event.payload?.actorId!==actorId)refreshRemote(event.payload)
    if(event.type==='editor-start'||event.type==='editor-stop')applyEditorEvent(event.type,event.payload)
   }
  })
  return()=>{clearTimeout(refreshRef.current);clientRef.current?.destroy();clientRef.current=null}
 },[companyId,actorId,actor.name,actor.email,refreshRemote,applyEditorEvent])

 const broadcastChange=useCallback(change=>clientRef.current?.broadcast('operational-change',{
  ...change,
  organizationId:companyId,
  actorId,
  actorName:actor.name||actor.email||'Usuario',
  emittedAt:new Date().toISOString()
 })||false,[companyId,actorId,actor.name,actor.email])

 useEffect(()=>{
  const handler=event=>broadcastChange(event.detail||{})
  window.addEventListener('canapa:operational-change',handler)
  return()=>window.removeEventListener('canapa:operational-change',handler)
 },[broadcastChange])

 useEffect(()=>{
  const announce=(event,descriptor)=>clientRef.current?.broadcast(event,{
   ...descriptor,
   organizationId:companyId,
   actorId,
   actorName:actor.name||actor.email||'Usuario',
   emittedAt:new Date().toISOString()
  })
  const focusin=event=>{
   if(!event.target?.matches?.('input,select,textarea,[contenteditable="true"]'))return
   clearTimeout(blurRef.current)
   announce('editor-start',formDescriptor(event.target))
  }
  const focusout=event=>{
   if(!event.target?.matches?.('input,select,textarea,[contenteditable="true"]'))return
   const descriptor=formDescriptor(event.target)
   clearTimeout(blurRef.current)
   blurRef.current=setTimeout(()=>announce('editor-stop',descriptor),900)
  }
  document.addEventListener('focusin',focusin)
  document.addEventListener('focusout',focusout)
  return()=>{
   clearTimeout(blurRef.current)
   document.removeEventListener('focusin',focusin)
   document.removeEventListener('focusout',focusout)
  }
 },[companyId,actorId,actor.name,actor.email])

 useEffect(()=>{
  const timer=setInterval(()=>setEditors(current=>current.filter(item=>Date.now()-new Date(item.updatedAt).getTime()<EDITOR_TTL_MS)),10000)
  return()=>clearInterval(timer)
 },[])

 const currentEditors=useMemo(()=>editors.filter(item=>item.path===window.location.pathname),[editors])
 const value=useMemo(()=>({
  runtime,presence,onlineUsers:presence.length,lastEvent,editors,currentEditors,
  broadcast:(event,payload)=>clientRef.current?.broadcast(event,payload)||false,
  broadcastChange,
  refreshRemote
 }),[runtime,presence,lastEvent,editors,currentEditors,broadcastChange,refreshRemote])
 return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime(){
 const value=useContext(RealtimeContext)
 if(!value)throw new Error('useRealtime requiere RealtimeProvider')
 return value
}
