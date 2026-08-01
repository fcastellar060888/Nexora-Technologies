const list=value=>Array.isArray(value)?value:[]
const required=value=>String(value||'').trim()

export function createMaterialPlantFindingRecords(plants,{type,severity='Media',notes='',reportedAt=new Date().toISOString()}={}){
 const targets=list(plants).filter(Boolean)
 const findingType=required(type)
 if(!targets.length)throw new Error('Selecciona al menos una planta para registrar MIPE')
 if(!findingType)throw new Error('El tipo de hallazgo MIPE es obligatorio')
 if(Number.isNaN(Date.parse(reportedAt)))throw new Error('La fecha del hallazgo MIPE no es válida')
 const normalizedSeverity=required(severity)||'Media'
 const normalizedNotes=required(notes)
 return targets.map(plant=>({
  id:crypto.randomUUID(),
  materialPlantId:plant.id,
  entityType:'materialPlant',
  entityId:plant.id,
  plantId:plant.id,
  type:findingType,
  severity:normalizedSeverity,
  status:'Abierto',
  notes:normalizedNotes,
  reportedAt:new Date(reportedAt).toISOString(),
  reportDate:new Date(reportedAt).toISOString(),
  source:'material-plant-action',
  plantType:plant.plantType,
  lotId:plant.lotId,
  siteId:plant.siteId||null
 }))
}

export function appendMaterialPlantFindings(state,plants,draft){
 const records=createMaterialPlantFindingRecords(plants,draft)
 return{...state,findings:[...list(state.findings),...records]}
}

export function materialPlantFindingDetail(plants,{type,severity='Media'}={}){
 const count=list(plants).length
 return`${count} planta${count===1?'':'s'} · ${required(type)||'Hallazgo MIPE'} · Severidad ${required(severity)||'Media'}`
}
