const text=value=>String(value??'').trim()
const required=(value,label)=>{const normalized=text(value);if(!normalized)throw new Error(`${label} es obligatorio.`);return normalized}
const iso=(value,label)=>{const normalized=required(value,label),time=Date.parse(normalized);if(Number.isNaN(time))throw new Error(`${label} debe ser una fecha válida.`);return new Date(time).toISOString()}
const positive=(value,label)=>{const number=Number(value);if(!Number.isFinite(number)||number<=0)throw new Error(`${label} debe ser mayor que cero.`);return number}
const nonNegative=(value,label)=>{const number=Number(value);if(!Number.isFinite(number)||number<0)throw new Error(`${label} no puede ser negativo.`);return number}
const integerBetween=(value,min,max,label)=>{const number=Number(value);if(!Number.isInteger(number)||number<min||number>max)throw new Error(`${label} debe estar entre ${min} y ${max}.`);return number}
const enumValue=(value,values,label)=>{const normalized=required(value,label);if(!Object.values(values).includes(normalized))throw new Error(`${label} no pertenece al catálogo canónico.`);return normalized}
const plainObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)

function deepFreeze(value){
 if(!value||typeof value!=='object'||Object.isFrozen(value))return value
 Object.values(value).forEach(deepFreeze)
 return Object.freeze(value)
}

function scopeOf(value,label){
 if(!value)throw new Error(`${label} es obligatorio.`)
 return{organizationId:required(value.organizationId,`${label}.organizationId`),siteId:text(value.siteId)}
}

function assertSameOrganization(left,right,leftLabel,rightLabel){
 const a=scopeOf(left,leftLabel),b=scopeOf(right,rightLabel)
 if(a.organizationId!==b.organizationId)throw new Error(`${leftLabel} y ${rightLabel} deben pertenecer a la misma organización.`)
}

function assertCompatibleSite(left,right,leftLabel,rightLabel){
 assertSameOrganization(left,right,leftLabel,rightLabel)
 const a=text(left.siteId),b=text(right.siteId)
 if(a&&b&&a!==b)throw new Error(`${leftLabel} y ${rightLabel} deben pertenecer a la misma sede.`)
}

function optionalIso(value,label){return value?iso(value,label):''}
function metadata(value){return plainObject(value)?{...value}:{}}

export const MIPE_TARGET_TYPES=Object.freeze({POSITION:'POSITION',MATERIAL_PLANT:'MATERIAL_PLANT'})
export const MIPE_FINDING_STATUSES=Object.freeze({DETECTED:'DETECTED',EVALUATING:'EVALUATING',TREATMENT_APPROVED:'TREATMENT_APPROVED',IN_TREATMENT:'IN_TREATMENT',FOLLOW_UP:'FOLLOW_UP',RESOLVED:'RESOLVED',PLANT_REMOVED:'PLANT_REMOVED',FALSE_POSITIVE:'FALSE_POSITIVE'})
export const MIPE_INTERVENTION_TYPES=Object.freeze({TREATMENT:'TREATMENT',FOLLOW_UP:'FOLLOW_UP',INSPECTION:'INSPECTION'})
export const MIPE_TREATMENT_STATUSES=Object.freeze({SCHEDULED:'SCHEDULED',EXECUTED:'EXECUTED',CANCELLED:'CANCELLED'})
export const MIPE_DOSE_UNITS=Object.freeze({'mL/L':'mL/L','g/L':'g/L','mL/100 L':'mL/100 L','g/100 L':'g/100 L'})

export function calculateMipeTreatmentQuantity(dose,doseUnit,mixVolumeLiters){
 const amount=positive(dose,'dose'),volume=positive(mixVolumeLiters,'mixVolumeLiters'),unit=enumValue(doseUnit,MIPE_DOSE_UNITS,'doseUnit')
 return Number((unit.endsWith('/100 L')?amount*volume/100:amount*volume).toFixed(6))
}

export function mipeInventoryUnitForDose(doseUnit){
 const unit=enumValue(doseUnit,MIPE_DOSE_UNITS,'doseUnit')
 return unit.startsWith('mL')?'mL':'g'
}

export function createMipeIncident(input={}){
 return deepFreeze({
  id:required(input.id,'id'),
  organizationId:required(input.organizationId,'organizationId'),
  name:required(input.name,'name'),
  kind:required(input.kind||'OTHER','kind'),
  scientificName:text(input.scientificName),
  description:text(input.description),
  color:text(input.color),
  active:input.active!==false,
  metadata:metadata(input.metadata)
 })
}

export function createMipeFinding(input={}){
 const status=enumValue(input.status||MIPE_FINDING_STATUSES.DETECTED,MIPE_FINDING_STATUSES,'status'),reportedAt=iso(input.reportedAt||input.createdAt||new Date().toISOString(),'reportedAt'),followUpAt=optionalIso(input.followUpAt||input.followUpDate,'followUpAt')
 if(followUpAt&&Date.parse(followUpAt)<Date.parse(reportedAt))throw new Error('followUpAt no puede ser anterior a reportedAt.')
 return deepFreeze({
  id:required(input.id,'id'),
  organizationId:required(input.organizationId,'organizationId'),
  siteId:required(input.siteId,'siteId'),
  targetType:enumValue(input.targetType,MIPE_TARGET_TYPES,'targetType'),
  targetId:required(input.targetId,'targetId'),
  incidentId:required(input.incidentId,'incidentId'),
  severity:integerBetween(input.severity,1,4,'severity'),
  status,
  reportedAt,
  followUpAt,
  responsibleId:text(input.responsibleId||input.responsible),
  notes:text(input.notes),
  action:text(input.action),
  restrictsPropagation:input.restrictsPropagation===true,
  source:text(input.source)||'MIPE',
  evidenceIds:Array.isArray(input.evidenceIds)?[...new Set(input.evidenceIds.map(text).filter(Boolean))]:[],
  metadata:metadata(input.metadata)
 })
}

export function createMipeFindingFromReferences(input={},references={}){
 const incident=references.incident,target=references.target
 if(!incident?.id)throw new Error('Incident es obligatorio.')
 if(!target?.id)throw new Error('Target es obligatorio.')
 assertCompatibleSite(target,{organizationId:incident.organizationId,siteId:target.siteId},'Target','Incident')
 if(input.organizationId&&text(input.organizationId)!==text(target.organizationId))throw new Error('organizationId no coincide con el Target canónico.')
 if(input.siteId&&text(input.siteId)!==text(target.siteId))throw new Error('siteId no coincide con el Target canónico.')
 if(input.incidentId&&text(input.incidentId)!==text(incident.id))throw new Error('incidentId no coincide con el Incident canónico.')
 if(input.targetId&&text(input.targetId)!==text(target.id))throw new Error('targetId no coincide con el Target canónico.')
 return createMipeFinding({...input,organizationId:target.organizationId,siteId:target.siteId,incidentId:incident.id,targetId:target.id})
}

export function createMipeTreatment(input={},references={}){
 const finding=references.finding,product=references.product
 if(!finding?.id)throw new Error('Finding es obligatorio.')
 if(!product?.id)throw new Error('Product es obligatorio.')
 assertCompatibleSite(finding,product,'Finding','Product')
 const dose=positive(input.dose,'dose'),doseUnit=enumValue(input.doseUnit,MIPE_DOSE_UNITS,'doseUnit'),mixVolumeLiters=positive(input.mixVolumeLiters??input.mixVolume,'mixVolumeLiters'),inventoryUnit=mipeInventoryUnitForDose(doseUnit)
 if(text(product.unit)!==inventoryUnit)throw new Error(`La unidad de inventario del Product debe ser ${inventoryUnit}.`)
 if(Number(product.doseMin||0)>0&&dose<Number(product.doseMin))throw new Error('dose está por debajo de la dosis mínima del Product.')
 if(Number(product.doseMax||0)>0&&dose>Number(product.doseMax))throw new Error('dose supera la dosis máxima del Product.')
 const scheduledFor=iso(input.scheduledFor||input.date||new Date().toISOString(),'scheduledFor'),createdAt=iso(input.createdAt||new Date().toISOString(),'createdAt')
 return deepFreeze({
  id:required(input.id,'id'),
  organizationId:finding.organizationId,
  siteId:finding.siteId,
  findingId:finding.id,
  productId:product.id,
  dose,
  doseUnit,
  mixVolumeLiters,
  totalQuantity:calculateMipeTreatmentQuantity(dose,doseUnit,mixVolumeLiters),
  inventoryUnit,
  status:enumValue(input.status||MIPE_TREATMENT_STATUSES.SCHEDULED,MIPE_TREATMENT_STATUSES,'status'),
  scheduledFor,
  createdAt,
  responsibleId:text(input.responsibleId||input.responsible),
  notes:text(input.notes),
  productSnapshot:{name:text(product.name),unit:text(product.unit),doseMin:Number(product.doseMin||0),doseMax:Number(product.doseMax||0),doseUnit:text(product.doseUnit),reentryHours:nonNegative(product.reentryHours||0,'product.reentryHours'),withdrawalDays:nonNegative(product.withdrawalDays||0,'product.withdrawalDays'),cost:nonNegative(product.cost||0,'product.cost')},
  metadata:metadata(input.metadata)
 })
}

export function createMipeIntervention(input={},references={}){
 const finding=references.finding,treatment=references.treatment||null
 if(!finding?.id)throw new Error('Finding es obligatorio.')
 const type=enumValue(input.type||MIPE_INTERVENTION_TYPES.FOLLOW_UP,MIPE_INTERVENTION_TYPES,'type')
 if(treatment){
  assertCompatibleSite(finding,treatment,'Finding','Treatment')
  if(text(treatment.findingId)!==text(finding.id))throw new Error('Treatment no pertenece al Finding indicado.')
 }
 if(type===MIPE_INTERVENTION_TYPES.TREATMENT&&!treatment?.id)throw new Error('Una intervención TREATMENT requiere Treatment.')
 const performedAt=iso(input.performedAt||new Date().toISOString(),'performedAt'),nextReviewAt=optionalIso(input.nextReviewAt,'nextReviewAt')
 if(nextReviewAt&&Date.parse(nextReviewAt)<Date.parse(performedAt))throw new Error('nextReviewAt no puede ser anterior a performedAt.')
 return deepFreeze({
  id:required(input.id,'id'),
  organizationId:finding.organizationId,
  siteId:finding.siteId,
  findingId:finding.id,
  treatmentId:treatment?.id||'',
  type,
  performedAt,
  nextReviewAt,
  responsibleId:text(input.responsibleId||input.responsible),
  outcome:text(input.outcome),
  notes:text(input.notes),
  evidenceIds:Array.isArray(input.evidenceIds)?[...new Set(input.evidenceIds.map(text).filter(Boolean))]:[],
  metadata:metadata(input.metadata)
 })
}

export function assertMipeReferenceScope(entity,reference,{entityLabel='Entidad MIPE',referenceLabel='Referencia'}={}){
 assertCompatibleSite(entity,reference,entityLabel,referenceLabel)
 return true
}
