import{useState}from'react'
import{clearSelection,createBulkActionRequest,createSelection,selectionSummary,toggleSelection}from'../core/selection/index.js'

const emptyDraft=()=>({title:'',detail:'',confirmed:false})
const selectionFor=siteId=>createSelection({scopeType:'cultivation.site.plants',scopeId:siteId||'unassigned'})

export function useUnifiedMapSelection({state,siteId,update}){
 const[selectionMode,setSelectionMode]=useState(false)
 const[selection,setSelection]=useState(()=>selectionFor(siteId))
 const[bulkDraft,setBulkDraft]=useState(emptyDraft)
 const houseIds=new Set(state.houses.filter(item=>item.siteId===siteId&&item.active!==false).map(item=>item.id))
 const bedIds=new Set(state.beds.filter(item=>houseIds.has(item.houseId)&&item.active!==false).map(item=>item.id))
 const availablePlantIds=state.plantPositions.filter(item=>bedIds.has(item.bedId)&&item.active!==false).map(item=>item.id)
 const summary=selectionSummary(selection,availablePlantIds)
 const resetForSite=nextSiteId=>{setSelection(selectionFor(nextSiteId));setSelectionMode(false);setBulkDraft(emptyDraft())}
 const choosePlant=(payload,onOpen)=>{if(selectionMode){setSelection(current=>toggleSelection(current,payload.plant.id));onOpen(null);return}onOpen(payload)}
 const toggleMode=onOpen=>setSelectionMode(value=>{const next=!value;if(!next){setSelection(current=>clearSelection(current));setBulkDraft(emptyDraft())}onOpen(null);return next})
 const submit=event=>{event.preventDefault();if(!bulkDraft.confirmed)return
  const request=createBulkActionRequest({selection,actionType:'cultivation.plant.observation.register',availableIds:availablePlantIds,metadata:{title:bulkDraft.title,detail:bulkDraft.detail,type:'Observación'}})
  const occurredAt=new Date().toISOString()
  update(store=>({...store,plantEvents:[...(store.plantEvents||[]),...request.targetIds.map(plantId=>({id:crypto.randomUUID(),plantId,type:'Observación',title:bulkDraft.title,detail:bulkDraft.detail,date:occurredAt,createdAt:occurredAt}))]}),{module:'Mapa unificado',action:'Observación masiva registrada',detail:`${request.targetCount} plantas · ${bulkDraft.title}`})
  setSelection(current=>clearSelection(current));setBulkDraft(emptyDraft())
 }
 return{selectionMode,selection,setSelection,bulkDraft,setBulkDraft,availablePlantIds,summary,resetForSite,choosePlant,toggleMode,submit}
}
