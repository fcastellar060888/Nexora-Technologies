import{applyMaterialPlantUnitPatch}from'./materialPlantActions.js'

const list=value=>Array.isArray(value)?value:[]
const required=value=>String(value||'').trim()
const closedStatuses=new Set(['Resuelto','Falso positivo'])

export const MIPE_BLOCKING_SEVERITIES=Object.freeze(['Crítica'])
export const MIPE_RESTRICTED_AVAILABILITY='Bloqueada por MIPE'
export const MIPE_RELEASED_AVAILABILITY='Disponible para corte'
export const MIPE_INTERVENTION_TYPES=Object.freeze({TREATMENT:'Tratamiento',FOLLOW_UP:'Seguimiento'})

export function shouldSuggestMipeBlock(severity){return MIPE_BLOCKING_SEVERITIES.includes(required(severity))}
export function isOpenMipeFinding(finding){return Boolean(finding)&&!closedStatuses.has(finding.status)}
export function openBlockingMipeFindings(state,plantId,{excludeFindingId=''}={}){return list(state?.findings).filter(item=>item.materialPlantId===plantId&&item.id!==excludeFindingId&&item.restrictsPropagation===true&&isOpenMipeFinding(item))}
export function interventionsForFinding(state,findingId){return list(state?.mipeInterventions).filter(item=>item.findingId===findingId).sort((a,b)=>Date.parse(b.performedAt)-Date.parse(a.performedAt))}

export function createMaterialPlantFindingRecords(plants,{incidentId='',type,severity='Media',notes='',reportedAt=new Date().toISOString(),restrictAvailability=false}={}){
 const targets=list(plants).filter(Boolean),findingType=required(type),canonicalIncidentId=required(incidentId)
 if(!targets.length)throw new Error('Selecciona al menos una planta para registrar MIPE')
 if(!findingType)throw new Error('El tipo de hallazgo MIPE es obligatorio')
 if(Number.isNaN(Date.parse(reportedAt)))throw new Error('La fecha del hallazgo MIPE no es válida')
 const normalizedSeverity=required(severity)||'Media',normalizedNotes=required(notes)
 return targets.map(plant=>({id:crypto.randomUUID(),incidentId:canonicalIncidentId||null,materialPlantId:plant.id,entityType:'materialPlant',entityId:plant.id,plantId:plant.id,type:findingType,severity:normalizedSeverity,status:'Abierto',notes:normalizedNotes,reportedAt:new Date(reportedAt).toISOString(),reportDate:new Date(reportedAt).toISOString(),source:'material-plant-action',plantType:plant.plantType,lotId:plant.lotId,siteId:plant.siteId||null,unitIndex:plant.unitIndex,plantCode:plant.code||plant.id,restrictsPropagation:Boolean(restrictAvailability),operationalAction:restrictAvailability?MIPE_RESTRICTED_AVAILABILITY:''}))
}

export function appendMaterialPlantFindings(state,plants,draft){
 const targets=list(plants).filter(Boolean),records=createMaterialPlantFindingRecords(targets,draft)
 let next={...state,findings:[...list(state.findings),...records]}
 if(!draft?.restrictAvailability)return next
 next=applyMaterialPlantUnitPatch(next,targets,{operationalAvailability:MIPE_RESTRICTED_AVAILABILITY})
 const createdAt=new Date().toISOString(),plantEvents=[...list(next.plantEvents),...targets.map(plant=>({id:crypto.randomUUID(),plantId:plant.id,entityId:plant.id,type:'Disponibilidad operativa',title:'Planta bloqueada por MIPE',detail:`Hallazgo ${required(draft.type)} · Severidad ${required(draft.severity)||'Media'}`,date:createdAt,createdAt,source:'mipe-operational-rule'}))]
 return{...next,plantEvents}
}

export function appendMipeIntervention(state,{findingId,type=MIPE_INTERVENTION_TYPES.TREATMENT,product='',dose='',responsible='',outcome='',notes='',performedAt=new Date().toISOString(),nextReviewAt=''}={}){
 if(!findingId)throw new Error('Selecciona el hallazgo MIPE intervenido')
 if(!Object.values(MIPE_INTERVENTION_TYPES).includes(type))throw new Error('El tipo de intervención MIPE no es válido')
 if(Number.isNaN(Date.parse(performedAt)))throw new Error('La fecha de intervención MIPE no es válida')
 if(nextReviewAt&&Number.isNaN(Date.parse(nextReviewAt)))throw new Error('La próxima revisión MIPE no es válida')
 const finding=list(state?.findings).find(item=>item.id===findingId)
 if(!finding)throw new Error('No se encontró el hallazgo MIPE solicitado')
 if(!isOpenMipeFinding(finding))throw new Error('No se pueden agregar intervenciones a un hallazgo cerrado')
 if(type===MIPE_INTERVENTION_TYPES.TREATMENT&&!required(product))throw new Error('El producto o tratamiento aplicado es obligatorio')
 if(type===MIPE_INTERVENTION_TYPES.FOLLOW_UP&&!required(outcome))throw new Error('El resultado del seguimiento es obligatorio')
 const performed=new Date(performedAt).toISOString(),record={id:crypto.randomUUID(),findingId,materialPlantId:finding.materialPlantId,plantId:finding.materialPlantId,siteId:finding.siteId||null,lotId:finding.lotId||null,type,product:required(product),dose:required(dose),responsible:required(responsible),outcome:required(outcome),notes:required(notes),performedAt:performed,nextReviewAt:nextReviewAt?new Date(nextReviewAt).toISOString():'',createdAt:performed,source:'material-plant-mipe-intervention'}
 const title=type===MIPE_INTERVENTION_TYPES.TREATMENT?'Tratamiento MIPE registrado':'Seguimiento MIPE registrado'
 const detail=type===MIPE_INTERVENTION_TYPES.TREATMENT?`${record.product}${record.dose?` · ${record.dose}`:''}`:record.outcome
 return{...state,mipeInterventions:[...list(state?.mipeInterventions),record],plantEvents:[...list(state?.plantEvents),{id:crypto.randomUUID(),plantId:finding.materialPlantId,entityId:finding.materialPlantId,type:'MIPE',title,detail,date:performed,createdAt:performed,source:'mipe-intervention-rule'}]}
}

export function resolveMaterialPlantFinding(state,{findingId,status='Resuelto',resolutionNotes='',resolvedAt=new Date().toISOString(),releaseAvailability=true}={}){
 if(!findingId)throw new Error('Selecciona el hallazgo MIPE que deseas cerrar')
 if(!closedStatuses.has(status))throw new Error('El estado de cierre MIPE no es válido')
 if(Number.isNaN(Date.parse(resolvedAt)))throw new Error('La fecha de resolución MIPE no es válida')
 const finding=list(state?.findings).find(item=>item.id===findingId)
 if(!finding)throw new Error('No se encontró el hallazgo MIPE solicitado')
 if(!isOpenMipeFinding(finding))throw new Error('El hallazgo MIPE ya está cerrado')
 const interventions=interventionsForFinding(state,findingId)
 if(status==='Resuelto'&&!interventions.length)throw new Error('Registra al menos un tratamiento o seguimiento antes de resolver el hallazgo')
 if(status==='Falso positivo'&&!required(resolutionNotes))throw new Error('Justifica técnicamente el falso positivo')
 const closedAt=new Date(resolvedAt).toISOString(),findings=list(state.findings).map(item=>item.id===findingId?{...item,status,resolutionNotes:required(resolutionNotes),resolvedAt:closedAt,updatedAt:closedAt,interventionCount:interventions.length}:item)
 let next={...state,findings},released=false
 if(releaseAvailability&&finding.restrictsPropagation===true){const remaining=openBlockingMipeFindings(next,finding.materialPlantId);if(!remaining.length){const plant={id:finding.materialPlantId,lotId:finding.lotId,plantType:finding.plantType,unitIndex:finding.unitIndex??0,code:finding.plantCode||finding.materialPlantId,siteId:finding.siteId||null};next=applyMaterialPlantUnitPatch(next,[plant],{operationalAvailability:MIPE_RELEASED_AVAILABILITY});released=true}}
 const plantEvents=[...list(next.plantEvents),{id:crypto.randomUUID(),plantId:finding.materialPlantId,entityId:finding.materialPlantId,type:'MIPE',title:released?'Hallazgo MIPE resuelto y planta rehabilitada':'Hallazgo MIPE resuelto',detail:`${finding.type} · ${status} · ${interventions.length} intervención${interventions.length===1?'':'es'}${required(resolutionNotes)?` · ${required(resolutionNotes)}`:''}`,date:closedAt,createdAt:closedAt,source:'mipe-resolution-rule'}]
 return{state:{...next,plantEvents},released,interventionCount:interventions.length,remainingBlockingFindings:openBlockingMipeFindings(next,finding.materialPlantId).length}
}

export function materialPlantFindingDetail(plants,{type,severity='Media',restrictAvailability=false}={}){const count=list(plants).length;return`${count} planta${count===1?'':'s'} · ${required(type)||'Hallazgo MIPE'} · Severidad ${required(severity)||'Media'}${restrictAvailability?' · Bloqueo para corte':''}`}
