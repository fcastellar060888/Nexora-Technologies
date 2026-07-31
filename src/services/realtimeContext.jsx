import{createContext,useCallback,useContext,useEffect,useMemo,useRef,useState}from'react'
import{useStore}from'./store.jsx'
import{createRealtimePresence}from'./realtimePresence.js'

const RealtimeContext=createContext(null)
const REFRESH_DELAY_MS=450

export function RealtimeProvider({children}){
 const{state,hydrateFromPostgres}=useStore()
 const clientRef=useRef(null)
 const refreshRef=useRef(null)
 const[presence,setPresence]=useState([])
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

 useEffect(()=>{
  clientRef.current?.destroy()
  clientRef.current=null
  clearTimeout(refreshRef.current)
  setPresence([])
  if(!companyId){setRuntime({status:'idle',error:'',organizationId:'',attempt:0});return}
  clientRef.current=createRealtimePresence({
   organizationId:companyId,
   user:{id:actorId,name:actor.name||'',email:actor.email||''},
   onStatus:setRuntime,
   onPresence:setPresence,
   onEvent:event=>{
    setLastEvent({...event,receivedAt:new Date().toISOString()})
    if(event.type==='operational-change'&&event.payload?.actorId!==actorId)refreshRemote(event.payload)
   }
  })
  return()=>{clearTimeout(refreshRef.current);clientRef.current?.destroy();clientRef.current=null}
 },[companyId,actorId,actor.name,actor.email,refreshRemote])

 const broadcastChange=useCallback(change=>clientRef.current?.broadcast('operational-change',{
  ...change,
  organizationId:companyId,
  actorId,
  emittedAt:new Date().toISOString()
 })||false,[companyId,actorId])

 const value=useMemo(()=>({
  runtime,presence,onlineUsers:presence.length,lastEvent,
  broadcast:(event,payload)=>clientRef.current?.broadcast(event,payload)||false,
  broadcastChange,
  refreshRemote
 }),[runtime,presence,lastEvent,broadcastChange,refreshRemote])
 return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime(){
 const value=useContext(RealtimeContext)
 if(!value)throw new Error('useRealtime requiere RealtimeProvider')
 return value
}
