import{applyMaterialPlantUnitPatch}from'./materialPlantActions.js'

const list=value=>Array.isArray(value)?value:[]
const required=value=>String(value||'').trim()

export const MIPE_BLOCKING_SEVERITIES=Object.freeze(['Crítica'])
export const MIPE_RESTRICTED_AVAILABILITY='Bloqueada por MIPE'

export function shouldSuggestMipeBlock(severity){return MIPE_BLOCKING_SEVERITIES.includes(required(severity))}

export function createMaterialPlantFindingRecords(plants,{type,severity='Media',notes='',reportedAt=new Date().toISOString(),restrictAvailability=false}={}){
 const targets=list(plants).filter(Boolean)
 const findingType=required(type)
 if(!targets.length)throw new Error('Selecciona al menos una planta para registrar MIPE')
 if(!findingType)throw new Error('El tipo de hallazgo MIPE es obligatorio')
 if(Number.isNaN(Date.parse(reportedAt)))throw new Error('La fecha del hallazgo MIPE no es válida')
 const normalizedSeverity=required(severity)||'Media'
 const normalizedNotes=required(notes)
 return targets.map(plant=>({
  id:crypto.randomUUID(),materialPlantId:plant.id,entityType:'materialPlant',entityId:plant.id,plantId:plant.id,
  type:findingType,severity:normalizedSeverity,status:'Abierto',notes:normalizedNotes,
  reportedAt:new Date(reportedAt).toISOString(),reportDate:new Date(reportedAt).toISOString(),
  source:'material-plant-action',plantType:plant.plantType,lotId:plant.lotId,siteId:plant.siteId||null,
  restrictsPropagation:Boolean(restrictAvailability),operationalAction:restrictAvailability?MIPE_RESTRICTED_AVAILABILITY:''
 }))
}

export function appendMaterialPlantFindings(state,plants,draft){
 const targets=list(plants).filter(Boolean)
 const records=createMaterialPlantFindingRecords(targets,draft)
 let next={...state,findings:[...list(state.findings),...records]}
 if(!draft?.restrictAvailability)return next
 next=applyMaterialPlantUnitPatch(next,targets,{operationalAvailability:MIPE_RESTRICTED_AVAILABILITY})
 const createdAt=new Date().toISOString()
 const plantEvents=[...list(next.plantEvents),...targets.map(plant=>({
  id:crypto.randomUUID(),plantId:plant.id,entityId:plant.id,type:'Disponibilidad operativa',
  title:'Planta bloqueada por MIPE',detail:`Hallazgo ${required(draft.type)} · Severidad ${required(draft.severity)||'Media'}`,
  date:createdAt,createdAt,source:'mipe-operational-rule'
 }))]
 return{...next,plantEvents}
}

export function materialPlantFindingDetail(plants,{type,severity='Media',restrictAvailability=false}={}){
 const count=list(plants).length
 return`${count} planta${count===1?'':'s'} · ${required(type)||'Hallazgo MIPE'} · Severidad ${required(severity)||'Media'}${restrictAvailability?' · Bloqueo para corte':''}`
}
