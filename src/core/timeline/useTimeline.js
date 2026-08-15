import{useMemo,useSyncExternalStore}from'react'
import{timelineEngine}from'./timelineEngine.js'

export function useTimeline(filters={}){
 const version=useSyncExternalStore(timelineEngine.subscribe,timelineEngine.getVersion,timelineEngine.getVersion)
 const filtersKey=JSON.stringify(filters)
 return useMemo(()=>timelineEngine.query(filters),[version,filtersKey])
}
