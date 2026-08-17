const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const required=(value,label)=>{const normalized=text(value);if(!normalized)throw new Error(`${label} es obligatorio.`);return normalized}
const iso=(value,label)=>{const normalized=required(value,label),parsed=Date.parse(normalized);if(Number.isNaN(parsed))throw new Error(`${label} debe ser una fecha válida.`);return new Date(parsed).toISOString()}
const clone=value=>structuredClone(value)
const deepFreeze=value=>{if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.values(value).forEach(deepFreeze);return Object.freeze(value)}
const organizationOf=value=>text(value?.organizationId||value?.companyId||value?._organizationId)
const CLOSED_FINDING_STATES=new Set(['Resuelto','Falso positivo','Planta eliminada'])

export const MIPE_INTERVENTION_TYPES=Object.freeze({TREATMENT:'Tratamiento',FOLLOW_UP:'Seguimiento'})

function targetSnapshot(finding){
 const declared=text(finding?.targetType).toUpperCase(),targetId=text(finding?.targetId),materialPlantId=text(finding?.materialPlantId),plantPositionId=text(finding?.plantPositionId)
 if(declared==='MATERIAL_PLANT'&&(materialPlantId||targetId)){const id=materialPlantId||targetId;return deepFreeze({targetType:'MATERIAL_PLANT',targetId:id,materialPlantId:id})}
 if(declared==='POSITION'&&(plantPositionId||targetId)){const id=plantPositionId||targetId;return deepFreeze({targetType:'POSITION',targetId:id,plantPositionId:id})}
 if(materialPlantId)return deepFreeze({targetType:'MATERIAL_PLANT',targetId:materialPlantId,materialPlantId})
 if(plantPositionId)return deepFreeze({targetType:'POSITION',targetId:plantPositionId,plantPositionId})
 throw new Error('El Finding de la intervención MIPE no tiene un target operativo inequívoco.')
}
function actorSnapshot(actor={}){return deepFreeze({id:text(actor?.id)||'system',name:text(actor?.name)||'Sistema'})}
function assignmentEvent({id,responsible,actor,occurredAt,kind,previousResponsible=''}){
 return deepFreeze({id,kind,previousResponsible:text(previousResponsible),responsible:text(responsible),actor:actorSnapshot(actor),occurredAt})
}
function assertFinding(finding,organizationId){
 if(!finding?.id)throw new Error('La intervención MIPE requiere un Finding válido.')
 if(organizationOf(finding)!==organizationId)throw new Error('El Finding de la intervención pertenece a otra empresa.')
 if(CLOSED_FINDING_STATES.has(text(finding.status)))throw new Error(`El Finding está cerrado en ${finding.status} y no admite nuevas intervenciones.`)
}
function assertTreatment(treatment,finding,organizationId,siteId){
 if(!treatment)return null
 if(organizationOf(treatment)!==organizationId)throw new Error('El Treatment de la intervención pertenece a otra empresa.')
 if(text(treatment.findingId)!==text(finding.id))throw new Error('El Treatment no pertenece al Finding de la intervención.')
 if(siteId&&text(treatment.siteId)&&text(treatment.siteId)!==siteId)throw new Error('El Treatment pertenece a otra sede.')
 return treatment
}

export function createCanonicalMipeIntervention({finding,treatment=null,input={},organizationId,commandId,actor={},occurredAt}={}){
 const owner=required(organizationId,'organizationId'),id=required(commandId,'commandId')
 assertFinding(finding,owner)
 const siteId=required(finding.siteId,'finding.siteId'),linkedTreatment=assertTreatment(treatment,finding,owner,siteId)
 if(text(input.treatmentId)&&!linkedTreatment)throw new Error('La intervención referencia un Treatment no verificado.')
 const type=required(input.type,'type')
 if(!Object.values(MIPE_INTERVENTION_TYPES).includes(type))throw new Error(`Tipo de intervención MIPE no soportado: ${type}`)
 const performedAt=iso(input.performedAt||occurredAt,'performedAt'),findingStart=Date.parse(finding.reportedAt||finding.createdAt||'')
 if(Number.isFinite(findingStart)&&Date.parse(performedAt)<findingStart)throw new Error('La intervención MIPE no puede ocurrir antes del Finding.')
 const nextReviewAt=text(input.nextReviewAt)?iso(input.nextReviewAt,'nextReviewAt'):''
 if(nextReviewAt&&Date.parse(nextReviewAt)<Date.parse(performedAt))throw new Error('La próxima revisión MIPE no puede preceder la intervención.')
 const outcome=text(input.outcome)
 if(type===MIPE_INTERVENTION_TYPES.FOLLOW_UP&&!outcome)throw new Error('El seguimiento MIPE requiere un resultado.')
 const product=text(input.product),dose=text(input.dose),treatmentId=text(linkedTreatment?.id)
 if(type===MIPE_INTERVENTION_TYPES.TREATMENT&&!treatmentId)throw new Error('La intervención de tratamiento requiere un Treatment canónico verificado.')
 const responsible=text(input.responsible)||text(actor?.name)||'Sistema',when=iso(occurredAt||performedAt,'occurredAt'),target=targetSnapshot(finding)
 const record={
  id,organizationId:owner,siteId,findingId:text(finding.id),treatmentId:treatmentId||null,type,responsible,product:product||null,dose:dose||null,outcome:outcome||null,notes:text(input.notes),performedAt,nextReviewAt:nextReviewAt||null,
  findingSnapshot:{id:text(finding.id),status:text(finding.status),severity:finding.severity??null,incidentId:text(finding.incidentId)||null,...target},
  treatmentSnapshot:linkedTreatment?{id:text(linkedTreatment.id),status:text(linkedTreatment.status),productId:text(linkedTreatment.productId)||null,lotId:text(linkedTreatment.lotId)||null,executedAt:text(linkedTreatment.executedAt)||null}:null,
  assignmentHistory:[assignmentEvent({id:`${id}:assignment:created`,responsible,actor,occurredAt:when,kind:'ASSIGNED'})],createdAt:when,updatedAt:when
 }
 return deepFreeze(record)
}

export function reassignCanonicalMipeIntervention(intervention,{responsible,commandId,actor={},occurredAt}={}){
 if(!intervention?.id)throw new Error('La reasignación requiere una intervención MIPE válida.')
 const nextResponsible=required(responsible,'responsible'),id=required(commandId,'commandId'),history=list(intervention.assignmentHistory),eventId=`${id}:assignment:reassigned`
 if(history.some(item=>item.id===eventId))return deepFreeze(clone(intervention))
 const when=iso(occurredAt||new Date().toISOString(),'occurredAt'),last=history.at(-1),lastTime=Date.parse(last?.occurredAt||intervention.createdAt||'')
 if(Number.isFinite(lastTime)&&Date.parse(when)<lastTime)throw new Error('La reasignación MIPE no puede retroceder el tiempo del historial.')
 if(text(intervention.responsible)===nextResponsible)throw new Error('La reasignación MIPE debe cambiar el responsable.')
 const event=assignmentEvent({id:eventId,responsible:nextResponsible,previousResponsible:intervention.responsible,actor,occurredAt:when,kind:'REASSIGNED'})
 return deepFreeze({...clone(intervention),responsible:nextResponsible,updatedAt:when,assignmentHistory:[...history,event]})
}

export function verifyCanonicalMipeIntervention(intervention){
 const errors=[],history=list(intervention?.assignmentHistory),owner=organizationOf(intervention)
 if(!text(intervention?.id))errors.push('Falta intervention.id.')
 if(!owner)errors.push('Falta organizationId.')
 if(!text(intervention?.siteId))errors.push('Falta siteId.')
 if(!text(intervention?.findingId))errors.push('Falta findingId.')
 if(!Object.values(MIPE_INTERVENTION_TYPES).includes(text(intervention?.type)))errors.push('Tipo de intervención inválido.')
 const performed=Date.parse(intervention?.performedAt||'');if(Number.isNaN(performed))errors.push('performedAt inválido.')
 if(intervention?.nextReviewAt&&Date.parse(intervention.nextReviewAt)<performed)errors.push('nextReviewAt precede performedAt.')
 if(intervention?.type===MIPE_INTERVENTION_TYPES.FOLLOW_UP&&!text(intervention?.outcome))errors.push('Seguimiento sin resultado.')
 if(intervention?.type===MIPE_INTERVENTION_TYPES.TREATMENT&&!text(intervention?.treatmentId))errors.push('Tratamiento sin Treatment canónico.')
 if(!history.length)errors.push('Falta assignmentHistory.')
 const ids=new Set();let previous=-Infinity
 for(const event of history){if(ids.has(event?.id))errors.push(`assignment event duplicado: ${event?.id}`);ids.add(event?.id);const time=Date.parse(event?.occurredAt||'');if(Number.isNaN(time)||time<previous)errors.push(`assignment history inválido: ${event?.id}`);previous=time}
 if(history.length&&text(history.at(-1)?.responsible)!==text(intervention?.responsible))errors.push('El responsable actual no coincide con assignmentHistory.')
 return{valid:errors.length===0,errors}
}
