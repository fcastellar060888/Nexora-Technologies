const text=value=>String(value??'').trim()
const required=(value,label)=>{const normalized=text(value);if(!normalized)throw new Error(`${label} es obligatorio.`);return normalized}
const number=(value,label,{min=0,positive=false}={})=>{const parsed=Number(value);if(!Number.isFinite(parsed)||(positive?parsed<=0:parsed<min))throw new Error(`${label} no es válido.`);return parsed}
const iso=(value,label)=>{const normalized=required(value,label),time=Date.parse(normalized);if(Number.isNaN(time))throw new Error(`${label} debe ser una fecha válida.`);return new Date(time).toISOString()}
const optionalIso=(value,label)=>text(value)?iso(value,label):''
const ownerOf=value=>text(value?.organizationId||value?.companyId||value?._organizationId)
const deepFreeze=value=>{if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.values(value).forEach(deepFreeze);return Object.freeze(value)}

export const MIPE_INCIDENT_CATEGORIES=Object.freeze(['Plaga','Enfermedad','Nutricional','Ambiental','Daño físico','Otro'])
export const MIPE_INCIDENT_RISKS=Object.freeze(['Bajo','Medio','Alto','Crítico'])
export const MIPE_EXECUTABLE_PRODUCT_CATEGORIES=Object.freeze(['MIPE','Biológico','Adyuvante'])
export const MIPE_EXECUTABLE_DOSE_UNITS=Object.freeze(['mL/L','g/L','mL/100 L','g/100 L'])

function validWindow({validFrom='',validUntil=''}={},label='vigencia'){
 const from=optionalIso(validFrom,`${label}.validFrom`),until=optionalIso(validUntil,`${label}.validUntil`)
 if(from&&until&&Date.parse(until)<Date.parse(from))throw new Error(`${label}.validUntil no puede preceder validFrom.`)
 return{validFrom:from,validUntil:until}
}
function assertAtWindow(at,window,label){
 const when=Date.parse(iso(at,`${label}.at`))
 if(window.validFrom&&when<Date.parse(window.validFrom))throw new Error(`${label} todavía no está vigente.`)
 if(window.validUntil&&when>Date.parse(window.validUntil))throw new Error(`${label} ya no está vigente.`)
}
function category(value,values,label){const normalized=required(value,label);if(!values.includes(normalized))throw new Error(`${label} no pertenece al catálogo MIPE.`);return normalized}

export function createMipeIncidentCatalogRecord(input={}){
 const window=validWindow(input,'incident')
 return deepFreeze({
  id:required(input.id,'incident.id'),
  organizationId:required(input.organizationId,'incident.organizationId'),
  name:required(input.name,'incident.name'),
  category:category(input.category||'Otro',MIPE_INCIDENT_CATEGORIES,'incident.category'),
  risk:category(input.risk||'Medio',MIPE_INCIDENT_RISKS,'incident.risk'),
  scientificName:text(input.scientificName),
  description:text(input.description),
  color:text(input.color)||'#e67e22',
  active:input.active!==false,
  ...window,
  createdAt:iso(input.createdAt,'incident.createdAt'),
  archivedAt:optionalIso(input.archivedAt,'incident.archivedAt'),
  archiveReason:text(input.archiveReason),
  metadata:input.metadata&&typeof input.metadata==='object'&&!Array.isArray(input.metadata)?structuredClone(input.metadata):{}
 })
}

export function assertMipeIncidentUsable(incident,{organizationId,at=new Date().toISOString()}={}){
 if(!incident?.id)throw new Error('Selecciona una incidencia válida.')
 const owner=required(organizationId,'organizationId'),declared=ownerOf(incident)
 if(declared&&declared!==owner)throw new Error('La incidencia pertenece a otra empresa.')
 if(incident.active===false||text(incident.archivedAt))throw new Error('La incidencia está archivada y no admite nuevos hallazgos.')
 const window=validWindow(incident,'incident')
 assertAtWindow(at,window,'La incidencia')
 return true
}

export function archiveMipeIncidentRecord(incident,{organizationId,commandId,actor={},occurredAt,reason=''}={}){
 if(!incident?.id)throw new Error('La incidencia es obligatoria.')
 const owner=required(organizationId,'organizationId'),declared=ownerOf(incident)
 if(declared&&declared!==owner)throw new Error('No se puede archivar una incidencia de otra empresa.')
 const at=iso(occurredAt,'occurredAt'),eventId=`${required(commandId,'commandId')}:incident:archived`
 const history=Array.isArray(incident.lifecycleHistory)?incident.lifecycleHistory:[]
 if(history.some(item=>item?.id===eventId))return deepFreeze(structuredClone(incident))
 if(incident.active===false||text(incident.archivedAt))throw new Error('La incidencia ya está archivada.')
 const event=deepFreeze({id:eventId,type:'ARCHIVED',occurredAt:at,reason:text(reason),actor:{id:text(actor?.id)||'system',name:text(actor?.name)||'Sistema'}})
 return deepFreeze({...structuredClone(incident),organizationId:owner,active:false,archivedAt:at,archiveReason:text(reason),updatedAt:at,lifecycleHistory:[...history,event]})
}

function inventoryUnitForDoseUnit(doseUnit){return doseUnit.startsWith('mL')?'mL':'g'}

export function createExecutableMipeProductSnapshot(product,{organizationId,siteId='',at=new Date().toISOString(),requestedDoseUnit=''}={}){
 if(!product?.id)throw new Error('Selecciona un producto válido.')
 const owner=required(organizationId,'organizationId'),declared=ownerOf(product)
 if(declared&&declared!==owner)throw new Error('El producto pertenece a otra empresa.')
 const productSite=text(product.siteId),targetSite=text(siteId)
 if(productSite&&targetSite&&productSite!==targetSite)throw new Error('El producto pertenece a otra sede.')
 if(product.active===false||text(product.archivedAt))throw new Error('El producto MIPE está archivado o inactivo.')
 const productCategory=category(product.category,MIPE_EXECUTABLE_PRODUCT_CATEGORIES,'product.category')
 const window=validWindow(product,'product'),approvedAt=iso(at,'product.at')
 assertAtWindow(approvedAt,window,'El producto MIPE')
 const doseUnit=required(product.doseUnit||requestedDoseUnit,'product.doseUnit')
 if(!MIPE_EXECUTABLE_DOSE_UNITS.includes(doseUnit))throw new Error('product.doseUnit no pertenece al catálogo MIPE.')
 if(requestedDoseUnit&&text(requestedDoseUnit)!==doseUnit)throw new Error('La unidad de dosis solicitada no coincide con el perfil técnico vigente del producto.')
 const inventoryUnit=required(product.unit,'product.unit'),expectedUnit=inventoryUnitForDoseUnit(doseUnit)
 if(inventoryUnit!==expectedUnit)throw new Error(`La unidad de inventario del producto debe ser ${expectedUnit}.`)
 const doseMin=number(product.doseMin||0,'product.doseMin'),doseMax=number(product.doseMax||0,'product.doseMax')
 if(doseMax>0&&doseMin>doseMax)throw new Error('product.doseMin no puede superar product.doseMax.')
 const revision=Number(product.technicalRevision||product.version||1)
 if(!Number.isSafeInteger(revision)||revision<1)throw new Error('product.technicalRevision debe ser un entero positivo.')
 return deepFreeze({
  id:text(product.id),organizationId:owner,siteId:productSite||targetSite||null,name:required(product.name,'product.name'),category:productCategory,
  activeIngredient:text(product.activeIngredient),manufacturer:text(product.manufacturer),registrationNumber:text(product.registrationNumber),
  unit:inventoryUnit,doseMin,doseMax,doseUnit,reentryHours:number(product.reentryHours||0,'product.reentryHours'),withdrawalDays:number(product.withdrawalDays||0,'product.withdrawalDays'),cost:number(product.cost||0,'product.cost'),
  validFrom:window.validFrom||null,validUntil:window.validUntil||null,technicalRevision:revision,approvedAt,source:'mipe-product-profile'
 })
}

export function assertExecutableMipeProductSnapshot(snapshot,{at,dose,doseUnit}={}){
 if(!snapshot?.id||snapshot.source!=='mipe-product-profile')throw new Error('El Treatment no contiene un perfil técnico MIPE ejecutable.')
 const window={validFrom:text(snapshot.validFrom),validUntil:text(snapshot.validUntil)}
 assertAtWindow(at,window,'El perfil técnico del Treatment')
 const requestedUnit=required(doseUnit||snapshot.doseUnit,'doseUnit')
 if(requestedUnit!==snapshot.doseUnit)throw new Error('La unidad de dosis no coincide con el snapshot técnico aprobado.')
 const amount=number(dose,'dose',{positive:true})
 if(Number(snapshot.doseMin||0)>0&&amount<Number(snapshot.doseMin))throw new Error('La dosis está por debajo del snapshot técnico aprobado.')
 if(Number(snapshot.doseMax||0)>0&&amount>Number(snapshot.doseMax))throw new Error('La dosis supera el snapshot técnico aprobado.')
 return true
}
