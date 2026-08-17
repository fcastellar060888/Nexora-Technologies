import{useEffect,useMemo,useState}from'react'
import{useNavigate}from'react-router-dom'
import Card from'../components/Card'
import PageHeader from'../components/PageHeader'
import SiteOverviewMap from'../components/SiteOverviewMap.jsx'
import PlantPassportDrawer from'../components/PlantPassportDrawer.jsx'
import MaterialPlantMapLayer from'../components/MaterialPlantMapLayer.jsx'
import UnifiedMapToolbar from'../components/UnifiedMapToolbar.jsx'
import UnifiedMapCanvas from'../components/UnifiedMapCanvas.jsx'
import PlantDrawer from'../components/UnifiedMapCuttingDrawer.jsx'
import BulkSelectionPanel from'../components/UnifiedMapSelectionPanel.jsx'
import{publishDomainEvent}from'../core/events/publishDomainEvent.js'
import{operationalContextForPlant,operationalContextOptions,scopeOperationalState,transitionOperationalContext}from'../domain/operationalContext.js'
import{executePlantEventCommand}from'../services/plantEventCommand.js'
import{useStore}from'../services/store'
import{useUnifiedMapSelection}from'../services/useUnifiedMapSelection.js'

export default function UnifiedCultivationMapPage(){
 const{state,update}=useStore(),navigate=useNavigate()
 const contextOptions=operationalContextOptions(state,state.currentContext),activeSites=contextOptions.sites.filter(site=>site.active!==false)
 const siteId=state.currentContext?.siteId||activeSites[0]?.id||''
 const mapState=useMemo(()=>scopeOperationalState(state,{...(state.currentContext||{}),siteId,houseId:'',bedId:'',plantId:''}),[state,siteId])
 const[layer,setLayer]=useState('Estado'),[selectedPlant,setSelectedPlant]=useState(null)
 const executeMapPlantEvent=input=>executePlantEventCommand(state,input,{publishEvent:spec=>publishDomainEvent(state,spec),commit:(recipe,meta)=>update(recipe,meta)})
 const selection=useUnifiedMapSelection({state:mapState,siteId,executePlantEvent:executeMapPlantEvent})
 useEffect(()=>{if(!state.currentContext?.siteId&&siteId)update(current=>({...current,currentContext:transitionOperationalContext(current,{siteId})}),{audit:false,sync:false})},[siteId,state.currentContext?.siteId,update])
 const changeSite=nextSiteId=>{update(current=>({...current,currentContext:transitionOperationalContext(current,{siteId:nextSiteId})}),{audit:false,sync:false});setSelectedPlant(null);selection.resetForSite(nextSiteId)}
 const openSelection=payload=>{if(payload?.kind==='plant')update(current=>({...current,currentContext:operationalContextForPlant(current,payload.plant.id)}),{audit:false,sync:false});setSelectedPlant(payload)}
 const choosePlant=payload=>selection.choosePlant(payload,openSelection)
 return <>
  <PageHeader title="Mapa unificado del cultivo" subtitle="Vista completa de la sede y operación detallada de naves, camas, bancos, bandejas y plantas. La infraestructura se configura fuera del mapa."/>
  <UnifiedMapToolbar activeSites={activeSites} siteId={siteId} layer={layer} selectionMode={selection.selectionMode} onSite={changeSite} onLayer={setLayer} onToggleSelection={()=>selection.toggleMode(setSelectedPlant)}/>
  <SiteOverviewMap state={mapState} siteId={siteId} layer={layer}/>
  {selection.selectionMode&&<BulkSelectionPanel summary={selection.summary} availablePlantIds={selection.availablePlantIds} setSelection={selection.setSelection} draft={selection.bulkDraft} setDraft={selection.setBulkDraft} onSubmit={selection.submit}/>} 
  <UnifiedMapCanvas state={mapState} siteId={siteId} layer={layer} selection={selection.selection} selectionMode={selection.selectionMode} onPlant={choosePlant} onCutting={setSelectedPlant}/>
  <Card title="Material vegetal individual" subtitle="Abuelas y madres de la sede dentro del mismo contexto operativo."><MaterialPlantMapLayer state={mapState} siteId={siteId}/></Card>
  {selectedPlant&&(selectedPlant.kind==='plant'?<PlantPassportDrawer state={mapState} plantId={selectedPlant.plant.id} onClose={()=>setSelectedPlant(null)} onOpen={()=>navigate(`/plant/${selectedPlant.plant.id}`)}/>:<PlantDrawer state={mapState} selection={selectedPlant} onClose={()=>setSelectedPlant(null)}/>)}
 </>
}
