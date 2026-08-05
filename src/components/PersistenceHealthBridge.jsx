import{useSyncExternalStore,useState}from'react'
import{useStore}from'../services/store.jsx'
import{getPersistenceRuntime,saveState,subscribePersistenceRuntime}from'../services/safeStorage.js'
import StateMessage from'./StateMessage.jsx'

export default function PersistenceHealthBridge(){
 const{state}=useStore()
 const runtime=useSyncExternalStore(subscribePersistenceRuntime,getPersistenceRuntime,getPersistenceRuntime)
 const[retrying,setRetrying]=useState(false)
 if(!runtime.dirty)return null
 const retry=()=>{
  setRetrying(true)
  try{saveState(state)}finally{setRetrying(false)}
 }
 return <aside className="persistence-health-alert" aria-label="Estado de persistencia local">
  <StateMessage
   type={retrying?'loading':'error'}
   title={retrying?'Reintentando guardado':'Cambios pendientes de guardar'}
   message={retrying?'Estamos intentando actualizar la caché offline. Mantén esta pestaña abierta.':`La caché offline no pudo actualizarse. Mantén esta pestaña abierta y vuelve a intentar.${runtime.lastError?` Detalle: ${runtime.lastError}`:''}`}
   actionLabel={retrying?undefined:'Reintentar guardado'}
   onAction={retrying?undefined:retry}
  />
 </aside>
}
