import{useEffect}from'react'
import{eventBus}from'../events/index.js'
import{timelineEngine}from'./timelineEngine.js'

export default function DomainEventTimelineBridge(){
 useEffect(()=>timelineEngine.connect(eventBus),[])
 return null
}
