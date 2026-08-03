import{useSyncExternalStore,useState}from'react'
import{useStore}from'../services/store.jsx'
import{getPersistenceRuntime,saveState,subscribePersistenceRuntime}from'../services/safeStorage.js'

export default function PersistenceHealthBridge(){
 const{state}=useStore()
 const runtime=useSyncExternalStore(subscribePersistenceRuntime,getPersistenceRuntime,getPersistenceRuntime)
 const[retrying,setRetrying]=useState(false)
 if(!runtime.dirty)return null
 const retry=()=>{
  setRetrying(true)
  try{saveState(state)}finally{setRetrying(false)}
 }
 return <aside role="alert" aria-live="assertive" style={{position:'fixed',right:'1rem',bottom:'1rem',zIndex:10000,maxWidth:'26rem',padding:'1rem',borderRadius:'12px',background:'var(--color-danger-surface,#3a1111)',color:'var(--color-danger-text,#fff)',boxShadow:'0 12px 32px rgba(0,0,0,.28)'}}>
  <strong>Cambios pendientes de guardar</strong>
  <p style={{margin:'.45rem 0 .75rem'}}>La caché offline no pudo actualizarse. Mantén esta pestaña abierta y vuelve a intentar. Detalle: {runtime.lastError}</p>
  <button type="button" onClick={retry} disabled={retrying}>{retrying?'Reintentando…':'Reintentar guardado'}</button>
 </aside>
}
