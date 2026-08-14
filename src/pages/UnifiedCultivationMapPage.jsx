import{useState}from'react'
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
import{useStore}from'../services/store'
import{useUnifiedMapSelection}from'../services/useUnifiedMapSelection.js'

export default function UnifiedCultivationMapPage(){
 const{state,update}=useStore(),navigate=useNavigate()
 const activeSites=state.sites.filter(site=>site.active!==false)
 const[siteId,setSiteId]=useState(state.currentContext?.siteId||activeSites[0]?.id||'')
 const[layer,setLayer]=useState('Estado'),[selectedPlant,setSelectedPlant]=useState(null)
 const selection=useUnifiedMapSelection({state,siteId,update})
 const changeSite=nextSiteId=>{setSiteId(nextSiteId);setSelectedPlant(null);selection.resetForSite(nextSiteId)}
 const choosePlant=payload=>selection.choosePlant(payload,setSelectedPlant)
 return <>
  <PageHeader title="Mapa unificado del cultivo" subtitle="Vista completa de la sede y operación detallada de naves, camas, bancos, bandejas y plantas. La infraestructura se configura fuera del mapa."/>
  <UnifiedMapToolbar activeSites={activeSites} siteId={siteId} layer={layer} selectionMode={selection.selectionMode} onSite={changeSite} onLayer={setLayer} onToggleSelection={()=>selection.toggleMode(setSelectedPlant)}/>
  <SiteOverviewMap state={state} siteId={siteId} layer={layer}/>
  {selection.selectionMode&&<BulkSelectionPanel summary={selection.summary} availablePlantIds={selection.availablePlantIds} setSelection={selection.setSelection} draft={selection.bulkDraft} setDraft={selection.setBulkDraft} onSubmit={selection.submit}/>} 
  <UnifiedMapCanvas state={state} siteId={siteId} layer={layer} selection={selection.selection} selectionMode={selection.selectionMode} onPlant={choosePlant} onCutting={setSelectedPlant}/>
  <Card title="Material vegetal individual" subtitle="Abuelas y madres de la sede dentro del mismo contexto operativo."><MaterialPlantMapLayer state={state} siteId={siteId}/></Card>
  {selectedPlant&&(selectedPlant.kind==='plant'?<PlantPassportDrawer state={state} plantId={selectedPlant.plant.id} onClose={()=>setSelectedPlant(null)} onOpen={()=>navigate(`/plant/${selectedPlant.plant.id}`)}/>:<PlantDrawer state={state} selection={selectedPlant} onClose={()=>setSelectedPlant(null)}/>)}
 </>
}
