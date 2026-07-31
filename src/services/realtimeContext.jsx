import{createContext,useCallback,useContext,useEffect,useMemo,useRef,useState}from'react'
import{useStore}from'./store.jsx'
import{createRealtimePresence}from'./realtimePresence.js'
import{RECORD_LOCK_TTL_MS,activeLocks,descriptorFromElement,lockForDescriptor}from'./recordLocks.js'

const RealtimeContext=createContext(null)
const REFRESH_DELAY_MS=450

export function RealtimeProvider({children}){
 const{state,hydrateFromPostgres}=useStore()
 const clientRef=useRef(null),refreshRef=useRef(null),blurRef=useRef(null)
 const[presence,setPresence]=useState([]),[editors,setEditors]=useState([]),[lastEvent,setLastEvent]=useState(null)
 const[runtime,setRuntime]=useState({status:'idle',error:'',organizationId:'',attempt:0})
 const companyId=state.currentContext?.companyId||''
 const actor=(state.users||[]).find(user=>user.activeSession)||{}
 const actorId=actor.remoteId||actor.id||''
 const actorName=actor.name||actor.email||'Usuario'

 const refreshRemote=useCallback(payload=>{
  if(!companyId||payload?.organizationId&&payload.organizationId!==companyId)return
  clearTimeout(refreshRef.current)
  refreshRef.current=setTimeout(()=>hydrateFromPostgres(companyId,{force:true,reason:'realtime-event'}),REFRESH_DELAY_MS)
 },[companyId,hydrateFromPostgres])

 const applyEditorEvent=useCallback((event,payload)=>{
  if(!payload?.actorId||payload.actorId===actorId)return
  setEditors(current=>{
   const active=activeLocks(current).filter(item=>item.actorId!==payload.actorId||item.path!==payload.path||item.formId!==payload.formId||item.recordId!==payload.recordId)
   if(event==='editor-stop')return active
   return[...active,{...payload,updatedAt:new Date().toISOString()}]
  })
 },[actorId])

 useEffect(()=>{
  clientRef.current?.destroy();clientRef.current=null;clearTimeout(refreshRef.current);setPresence([]);setEditors([])
  if(!companyId){setRuntime({status:'idle',error:'',organizationId:'',attempt:0});return}
  clientRef.current=createRealtimePresence({organizationId:companyId,user:{id:actorId,name:actor.name||'',email:actor.email||''},onStatus:setRuntime,onPresence:setPresence,onEvent:event=>{
   setLastEvent({...event,receivedAt:new Date().toISOString()})
   if(event.type==='operational-change'&&event.payload?.actorId!==actorId)refreshRemote(event.payload)
   if(event.type==='editor-start'||event.type==='editor-stop')applyEditorEvent(event.type,event.payload)
  }})
  return()=>{clearTimeout(refreshRef.current);clientRef.current?.destroy();clientRef.current=null}
 },[companyId,actorId,actor.name,actor.email,refreshRemote,applyEditorEvent])

 const broadcastChange=useCallback(change=>clientRef.current?.broadcast('operational-change',{...change,organizationId:companyId,actorId,actorName,emittedAt:new Date().toISOString()})||false,[companyId,actorId,actorName])
 useEffect(()=>{const handler=event=>broadcastChange(event.detail||{});window.addEventListener('canapa:operational-change',handler);return()=>window.removeEventListener('canapa:operational-change',handler)},[broadcastChange])

 useEffect(()=>{
  const announce=(event,descriptor)=>clientRef.current?.broadcast(event,{...descriptor,organizationId:companyId,actorId,actorName,emittedAt:new Date().toISOString()})
  const focusin=event=>{if(!event.target?.matches?.('input,select,textarea,[contenteditable="true"]'))return;clearTimeout(blurRef.current);announce('editor-start',descriptorFromElement(event.target))}
  const focusout=event=>{if(!event.target?.matches?.('input,select,textarea,[contenteditable="true"]'))return;const descriptor=descriptorFromElement(event.target);clearTimeout(blurRef.current);blurRef.current=setTimeout(()=>announce('editor-stop',descriptor),900)}
  document.addEventListener('focusin',focusin);document.addEventListener('focusout',focusout)
  return()=>{clearTimeout(blurRef.current);document.removeEventListener('focusin',focusin);document.removeEventListener('focusout',focusout)}
 },[companyId,actorId,actorName])

 useEffect(()=>{const timer=setInterval(()=>setEditors(current=>activeLocks(current)),10000);return()=>clearInterval(timer)},[])

 const currentEditors=useMemo(()=>activeLocks(editors).filter(item=>item.path===window.location.pathname),[editors])
 const getLock=useCallback(descriptor=>lockForDescriptor(editors,descriptor,actorId),[editors,actorId])

 useEffect(()=>{
  const apply=()=>document.querySelectorAll('form').forEach(form=>{
   const descriptor=descriptorFromElement(form)
   const lock=getLock(descriptor)
   form.classList.toggle('record-locked',Boolean(lock))
   form.dataset.lockedBy=lock?.actorName||''
   form.querySelectorAll('input,select,textarea,button[type="submit"],[contenteditable="true"]').forEach(control=>{
    if(lock){if(!control.hasAttribute('data-lock-original-disabled'))control.setAttribute('data-lock-original-disabled',control.disabled?'1':'0');control.disabled=true;control.setAttribute('aria-disabled','true')}
    else if(control.hasAttribute('data-lock-original-disabled')){control.disabled=control.getAttribute('data-lock-original-disabled')==='1';control.removeAttribute('data-lock-original-disabled');control.removeAttribute('aria-disabled')}
   })
  })
  apply();const observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true});return()=>observer.disconnect()
 },[getLock,currentEditors])

 const value=useMemo(()=>({runtime,presence,onlineUsers:presence.length,lastEvent,editors,currentEditors,getLock,lockTtlMs:RECORD_LOCK_TTL_MS,broadcast:(event,payload)=>clientRef.current?.broadcast(event,payload)||false,broadcastChange,refreshRemote}),[runtime,presence,lastEvent,editors,currentEditors,getLock,broadcastChange,refreshRemote])
 return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime(){const value=useContext(RealtimeContext);if(!value)throw new Error('useRealtime requiere RealtimeProvider');return value}
