import{activeOrganizationId}from'./organizationOwnership.js'
import{mipeRecordOrganizationId,mipeRecordsForOrganization}from'./mipeTenancy.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const TERMINAL_FINDING_STATES=new Set(['Resuelto','Falso positivo','Planta eliminada'])

export const MIPE_RESTRICTION_TYPES=Object.freeze({
 REENTRY:'REENTRY',
 HARVEST_WITHDRAWAL:'HARVEST_WITHDRAWAL',
 PROPAGATION_BLOCK:'PROPAGATION_BLOCK'
})

export const MIPE_RESTRICTED_OPERATIONS=Object.freeze({
 CULTIVATION_WORK:'CULTIVATION_WORK',
 HARVEST:'HARVEST',
 PROPAGATION_CUT:'PROPAGATION_CUT'
})

const OPERATION_BLOCKERS=Object.freeze({
 [MIPE_RESTRICTED_OPERATIONS.CULTIVATION_WORK]:Object.freeze([MIPE_RESTRICTION_TYPES.REENTRY]),
 [MIPE_RESTRICTED_OPERATIONS.HARVEST]:Object.freeze([MIPE_RESTRICTION_TYPES.REENTRY,MIPE_RESTRICTION_TYPES.HARVEST_WITHDRAWAL]),
 [MIPE_RESTRICTED_OPERATIONS.PROPAGATION_CUT]:Object.freeze([MIPE_RESTRICTION_TYPES.REENTRY,MIPE_RESTRICTION_TYPES.PROPAGATION_BLOCK])
})

function iso(value,label='fecha'){
 const normalized=text(value)
 if(!normalized||Number.isNaN(Date.parse(normalized)))throw new Error(`${label} MIPE no es válida.`)
 return new Date(normalized).toISOString()
}
function freeze(value){
 if(!value||typeof value!=='object'||Object.isFrozen(value))return value
 Object.values(value).forEach(freeze)
 return Object.freeze(value)
}
function targetOf(finding){
 const materialId=text(finding?.materialPlantId)||(text(finding?.targetType)==='MATERIAL_PLANT'?text(finding?.targetId):'')
 if(materialId)return{targetType:'MATERIAL_PLANT',targetId:materialId}
 const positionId=text(finding?.plantPositionId)||(text(finding?.targetType)==='POSITION'?text(finding?.targetId):'')
 if(positionId)return{targetType:'POSITION',targetId:positionId}
 return{targetType:'',targetId:''}
}
function openFinding(finding){return!TERMINAL_FINDING_STATES.has(text(finding?.status))}
function uniqueById(records,label){
 const seen=new Set()
 for(const record of records){
  const id=text(record?.id)
  if(!id)throw new Error(`${label} MIPE sin id.`)
  if(seen.has(id))throw new Error(`${label} MIPE tiene identidad duplicada dentro de la empresa activa.`)
  seen.add(id)
 }
 return records
}
function matchingFindings(state,{organizationId,targetType,targetId}){
 const allMatches=list(state?.findings).filter(item=>{const target=targetOf(item);return target.targetType===targetType&&target.targetId===targetId})
 for(const finding of allMatches){
  const owner=mipeRecordOrganizationId(state,'findings',finding)
  if(!owner)throw new Error('Existe evidencia MIPE del objetivo sin ownership inequívoco.')
 }
 return uniqueById(mipeRecordsForOrganization(state,'findings',organizationId).filter(item=>{const target=targetOf(item);return target.targetType===targetType&&target.targetId===targetId}),'Finding')
}
function restriction({id,type,organizationId,siteId,targetType,targetId,findingId,treatmentId='',startsAt='',endsAt='',reason=''}){
 return freeze({id,type,organizationId,siteId:text(siteId),targetType,targetId,findingId,treatmentId:text(treatmentId),startsAt:text(startsAt),endsAt:text(endsAt),reason:text(reason)})
}

export function projectMipeOperationalRestrictions(state,{targetType,targetId,organizationId=activeOrganizationId(state),at=new Date().toISOString()}={}){
 const owner=text(organizationId),type=text(targetType),id=text(targetId),when=iso(at,'La fecha de evaluación')
 if(!owner)throw new Error('organizationId es obligatorio para proyectar restricciones MIPE.')
 if(!['POSITION','MATERIAL_PLANT'].includes(type))throw new Error('El targetType de restricción MIPE no es válido.')
 if(!id)throw new Error('targetId es obligatorio para proyectar restricciones MIPE.')
 const now=Date.parse(when),findings=matchingFindings(state,{organizationId:owner,targetType:type,targetId:id}),findingIds=new Set(findings.map(item=>item.id)),restrictions=[]
 const treatments=uniqueById(mipeRecordsForOrganization(state,'treatments',owner).filter(item=>item?.status==='Ejecutado'&&findingIds.has(text(item?.findingId))),'Treatment')
 for(const treatment of treatments){
  const finding=findings.find(item=>item.id===treatment.findingId)
  if(!finding)continue
  const start=text(treatment.executedAt||finding.lastTreatmentAt||treatment.updatedAt||treatment.createdAt)
  const reentryEnd=text(treatment.reentryUntil||finding.reentryUntil)
  if(reentryEnd){
   const end=iso(reentryEnd,'La reentrada')
   if(Date.parse(end)>now)restrictions.push(restriction({id:`${owner}:${treatment.id}:reentry`,type:MIPE_RESTRICTION_TYPES.REENTRY,organizationId:owner,siteId:treatment.siteId||finding.siteId,targetType:type,targetId:id,findingId:finding.id,treatmentId:treatment.id,startsAt:start?iso(start,'La ejecución'):when,endsAt:end,reason:'Periodo de reentrada MIPE activo'}))
  }
  const withdrawalEnd=text(treatment.harvestRestrictedUntil||finding.harvestRestrictedUntil)
  if(withdrawalEnd){
   const end=iso(withdrawalEnd,'La carencia')
   if(Date.parse(end)>now)restrictions.push(restriction({id:`${owner}:${treatment.id}:withdrawal`,type:MIPE_RESTRICTION_TYPES.HARVEST_WITHDRAWAL,organizationId:owner,siteId:treatment.siteId||finding.siteId,targetType:type,targetId:id,findingId:finding.id,treatmentId:treatment.id,startsAt:start?iso(start,'La ejecución'):when,endsAt:end,reason:'Periodo de carencia MIPE activo'}))
  }
 }
 if(type==='MATERIAL_PLANT')for(const finding of findings){
  if(finding.restrictsPropagation===true&&openFinding(finding))restrictions.push(restriction({id:`${owner}:${finding.id}:propagation-block`,type:MIPE_RESTRICTION_TYPES.PROPAGATION_BLOCK,organizationId:owner,siteId:finding.siteId,targetType:type,targetId:id,findingId:finding.id,startsAt:text(finding.reportedAt||finding.createdAt),reason:'Hallazgo MIPE bloquea propagación'}))
 }
 const byType=Object.fromEntries(Object.values(MIPE_RESTRICTION_TYPES).map(value=>[value,restrictions.filter(item=>item.type===value)]))
 const latestEnd=items=>items.map(item=>item.endsAt).filter(Boolean).sort().at(-1)||''
 return freeze({
  organizationId:owner,targetType:type,targetId:id,evaluatedAt:when,
  restrictions,
  reentryBlocked:byType[MIPE_RESTRICTION_TYPES.REENTRY].length>0,
  harvestBlocked:byType[MIPE_RESTRICTION_TYPES.HARVEST_WITHDRAWAL].length>0,
  propagationBlocked:byType[MIPE_RESTRICTION_TYPES.PROPAGATION_BLOCK].length>0,
  reentryUntil:latestEnd(byType[MIPE_RESTRICTION_TYPES.REENTRY]),
  harvestRestrictedUntil:latestEnd(byType[MIPE_RESTRICTION_TYPES.HARVEST_WITHDRAWAL]),
  findingIds:[...new Set(restrictions.map(item=>item.findingId))],
  treatmentIds:[...new Set(restrictions.map(item=>item.treatmentId).filter(Boolean))]
 })
}

export function blockersForMipeOperation(state,{operation,targetType,targetId,organizationId=activeOrganizationId(state),at=new Date().toISOString()}={}){
 const blockers=OPERATION_BLOCKERS[operation]
 if(!blockers)throw new Error(`La operación restringible MIPE ${operation} no existe.`)
 const projection=projectMipeOperationalRestrictions(state,{targetType,targetId,organizationId,at})
 return freeze({projection,blockers:projection.restrictions.filter(item=>blockers.includes(item.type))})
}

export function assertMipeOperationAllowed(state,{operation,targetType,targetId,organizationId=activeOrganizationId(state),at=new Date().toISOString()}={}){
 const result=blockersForMipeOperation(state,{operation,targetType,targetId,organizationId,at})
 if(!result.blockers.length)return result.projection
 const reentry=result.blockers.filter(item=>item.type===MIPE_RESTRICTION_TYPES.REENTRY).map(item=>item.endsAt).filter(Boolean).sort().at(-1)
 const withdrawal=result.blockers.filter(item=>item.type===MIPE_RESTRICTION_TYPES.HARVEST_WITHDRAWAL).map(item=>item.endsAt).filter(Boolean).sort().at(-1)
 if(reentry)throw new Error(`Operación bloqueada por reentrada MIPE hasta ${reentry}.`)
 if(withdrawal)throw new Error(`No se puede cosechar: periodo de carencia MIPE activo hasta ${withdrawal}.`)
 throw new Error('Operación bloqueada por un hallazgo MIPE activo.')
}
