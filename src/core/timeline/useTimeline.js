import{useMemo,useSyncExternalStore}from'react'
import{timelineEngine}from'./timelineEngine.js'

export function useTimeline(filters={}){
 const version=useSyncExternalStore(timelineEngine.subscribe,timelineEngine.size,timelineEngine.size)
 return useMemo(()=>timelineEngine.query(filters),[version,JSON.stringify(filters)])
}
