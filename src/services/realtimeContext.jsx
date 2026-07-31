import{createContext,useContext,useEffect,useMemo,useRef,useState}from'react'
import{useStore}from'./store.jsx'
import{createRealtimePresence}from'./realtimePresence.js'

const RealtimeContext=createContext(null)

export function RealtimeProvider({children}){
 const{state}=useStore()
 const clientRef=useRef(null)
 const[presence,setPresence]=useState([])
 const[runtime,setRuntime]=useState({status:'idle',error:'',organizationId:'',attempt:0})
 const companyId=state.currentContext?.companyId||''
 const actor=(state.users||[]).find(user=>user.activeSession)||{}

 useEffect(()=>{
  clientRef.current?.destroy()
  clientRef.current=null
  setPresence([])
  if(!companyId){setRuntime({status:'idle',error:'',organizationId:'',attempt:0});return}
  clientRef.current=createRealtimePresence({
   organizationId:companyId,
   user:{id:actor.remoteId||actor.id||'',name:actor.name||'',email:actor.email||''},
   onStatus:setRuntime,
   onPresence:setPresence
  })
  return()=>{clientRef.current?.destroy();clientRef.current=null}
 },[companyId,actor.remoteId,actor.id,actor.name,actor.email])

 const value=useMemo(()=>({runtime,presence,onlineUsers:presence.length,broadcast:(event,payload)=>clientRef.current?.broadcast(event,payload)||false}),[runtime,presence])
 return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime(){
 const value=useContext(RealtimeContext)
 if(!value)throw new Error('useRealtime requiere RealtimeProvider')
 return value
}
