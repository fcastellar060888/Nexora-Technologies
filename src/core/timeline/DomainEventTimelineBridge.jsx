import{useEffect,useRef}from'react'
import{eventBus}from'../events/index.js'
import{domainEventToTimelineEntry}from'./timelineProjection.js'
import{timelineEngine}from'./timelineEngine.js'
import{useStore}from'../../services/store.jsx'

export default function DomainEventTimelineBridge(){
 const{state,update}=useStore()
 const hydrated=useRef(false)

 useEffect(()=>{
  if(hydrated.current)return
  timelineEngine.hydrate(state.timelineEntries||[])
  hydrated.current=true
 },[state.timelineEntries])

 useEffect(()=>eventBus.subscribe('*',event=>{
  const entry=domainEventToTimelineEntry(event)
  timelineEngine.record(entry)
  update(current=>{
   if((current.timelineEntries||[]).some(item=>item.id===entry.id))return current
   return{...current,timelineEntries:[...(current.timelineEntries||[]),entry].slice(-2000)}
  },{sync:false,audit:false})
 }),[update])

 return null
}
