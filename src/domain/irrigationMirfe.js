const text=value=>String(value??'').trim()
const required=(value,label)=>{const normalized=text(value);if(!normalized)throw new Error(`${label} es obligatorio.`);return normalized}
const positive=(value,label)=>{const number=Number(value);if(!Number.isFinite(number)||number<=0)throw new Error(`${label} debe ser mayor que cero.`);return number}
const nonNegative=(value,label)=>{const number=Number(value);if(!Number.isFinite(number)||number<0)throw new Error(`${label} no puede ser negativo.`);return number}
const positiveInteger=(value,label)=>{const number=positive(value,label);if(!Number.isInteger(number))throw new Error(`${label} debe ser un entero positivo.`);return number}
const iso=(value,label)=>{const normalized=required(value,label),time=Date.parse(normalized);if(Number.isNaN(time))throw new Error(`${label} debe ser una fecha válida.`);return new Date(time).toISOString()}
const enumValue=(value,values,label)=>{const normalized=required(value,label);if(!Object.values(values).includes(normalized))throw new Error(`${label} no pertenece al catálogo canónico.`);return normalized}
const plainObject=value=>value&&typeof value==='object'&&!Array.isArray(value)

function deepFreeze(value){
 if(!value||typeof value!=='object'||Object.isFrozen(value))return value
 Object.values(value).forEach(deepFreeze)
 return Object.freeze(value)
}

function numericRecord(value,label){
 if(!plainObject(value)||Object.keys(value).length===0)throw new Error(`${label} debe contener al menos una medición.`)
 const normalized={}
 for(const[key,raw]of Object.entries(value)){
  const name=required(key,`${label}.key`),number=Number(raw)
  if(!Number.isFinite(number))throw new Error(`${label}.${name} debe ser un número finito.`)
  normalized[name]=number
 }
 return normalized
}

function assertSameScope(left,right,leftLabel,rightLabel){
 if(!left||!right)throw new Error(`${leftLabel} y ${rightLabel} son obligatorios.`)
 if(left.organizationId!==right.organizationId)throw new Error(`${leftLabel} y ${rightLabel} deben pertenecer a la misma organización.`)
 if(left.siteId!==right.siteId)throw new Error(`${leftLabel} y ${rightLabel} deben pertenecer a la misma sede.`)
}

export const IRRIGATION_EMITTER_KINDS=Object.freeze({RING:'RING',STAKE:'STAKE',SHARED:'SHARED',MULTI:'MULTI',MANUAL:'MANUAL'})
export const IRRIGATION_TARGET_TYPES=Object.freeze({POSITION:'POSITION',BED:'BED',TRAY:'TRAY'})
export const MEASUREMENT_SOURCES=Object.freeze({SENSOR:'SENSOR',CONTROLLER:'CONTROLLER',MANUAL:'MANUAL',SAMPLE:'SAMPLE',IMPORTED:'IMPORTED',CALCULATED:'CALCULATED'})
export const IRRIGATION_PULSE_STATUSES=Object.freeze({PLANNED:'PLANNED',COMPLETED:'COMPLETED',CANCELLED:'CANCELLED'})
export const FERTIGATION_STATUSES=Object.freeze({PENDING:'PENDING',PREPARED:'PREPARED',APPLIED:'APPLIED',CANCELLED:'CANCELLED'})

export function createIrrigationEmitter(input={}){
 const kind=enumValue(input.kind,IRRIGATION_EMITTER_KINDS,'kind'),plantsPerEmitter=positiveInteger(input.plantsPerEmitter??(kind===IRRIGATION_EMITTER_KINDS.SHARED?2:1),'plantsPerEmitter')
 if(kind===IRRIGATION_EMITTER_KINDS.SHARED&&plantsPerEmitter<2)throw new Error('Un emisor compartido debe atender al menos dos plantas.')
 return deepFreeze({id:required(input.id,'id'),organizationId:required(input.organizationId,'organizationId'),siteId:required(input.siteId,'siteId'),name:required(input.name,'name'),kind,flowLitersPerHour:positive(input.flowLitersPerHour,'flowLitersPerHour'),outletCount:positiveInteger(input.outletCount??1,'outletCount'),stakesPerPlant:positiveInteger(input.stakesPerPlant??1,'stakesPerPlant'),plantsPerEmitter,controllerDeviceId:text(input.controllerDeviceId),active:input.active!==false,metadata:plainObject(input.metadata)?{...input.metadata}:{}})
}

export function createIrrigationSector(input={}){
 return deepFreeze({id:required(input.id,'id'),organizationId:required(input.organizationId,'organizationId'),siteId:required(input.siteId,'siteId'),name:required(input.name,'name'),houseId:text(input.houseId),zoneId:text(input.zoneId),active:input.active!==false,metadata:plainObject(input.metadata)?{...input.metadata}:{}})
}

export function createIrrigationAssignment(input={}){
 const validFrom=iso(input.validFrom||new Date().toISOString(),'validFrom'),validTo=input.validTo?iso(input.validTo,'validTo'):null
 if(validTo&&Date.parse(validTo)<Date.parse(validFrom))throw new Error('validTo no puede ser anterior a validFrom.')
 return deepFreeze({id:required(input.id,'id'),organizationId:required(input.organizationId,'organizationId'),siteId:required(input.siteId,'siteId'),sectorId:required(input.sectorId,'sectorId'),emitterId:required(input.emitterId,'emitterId'),targetType:enumValue(input.targetType,IRRIGATION_TARGET_TYPES,'targetType'),targetId:required(input.targetId,'targetId'),emitterCount:positiveInteger(input.emitterCount??1,'emitterCount'),plantsServed:positiveInteger(input.plantsServed??1,'plantsServed'),validFrom,validTo,active:input.active!==false})
}

export function irrigationAssignmentFromTopology(input={},references={}){
 const{emitter,sector}=references
 assertSameScope(emitter,sector,'Emitter','Sector')
 return createIrrigationAssignment({...input,organizationId:sector.organizationId,siteId:sector.siteId,sectorId:sector.id,emitterId:emitter.id})
}

export function createIrrigationPulse(input={}){
 const status=enumValue(input.status||IRRIGATION_PULSE_STATUSES.PLANNED,IRRIGATION_PULSE_STATUSES,'status'),startedAt=iso(input.startedAt,'startedAt'),completedAt=input.completedAt?iso(input.completedAt,'completedAt'):null
 if(completedAt&&Date.parse(completedAt)<Date.parse(startedAt))throw new Error('completedAt no puede ser anterior a startedAt.')
 const actual=input.actualVolumeLiters===null||input.actualVolumeLiters===undefined?null:nonNegative(input.actualVolumeLiters,'actualVolumeLiters')
 if(status===IRRIGATION_PULSE_STATUSES.COMPLETED&&actual===null)throw new Error('Un pulso completado requiere actualVolumeLiters.')
 return deepFreeze({id:required(input.id,'id'),organizationId:required(input.organizationId,'organizationId'),siteId:required(input.siteId,'siteId'),sectorId:required(input.sectorId,'sectorId'),source:enumValue(input.source,MEASUREMENT_SOURCES,'source'),status,startedAt,completedAt,durationSeconds:positive(input.durationSeconds,'durationSeconds'),plannedVolumeLiters:nonNegative(input.plannedVolumeLiters??0,'plannedVolumeLiters'),actualVolumeLiters:actual,responsibleId:text(input.responsibleId),deviceId:text(input.deviceId)})
}

export function createIrrigationMeasurement(input={}){
 return deepFreeze({id:required(input.id,'id'),organizationId:required(input.organizationId,'organizationId'),siteId:required(input.siteId,'siteId'),sectorId:required(input.sectorId,'sectorId'),pulseId:text(input.pulseId),measuredAt:iso(input.measuredAt,'measuredAt'),source:enumValue(input.source,MEASUREMENT_SOURCES,'source'),deviceId:text(input.deviceId),values:numericRecord(input.values,'values'),units:plainObject(input.units)?{...input.units}:{},notes:text(input.notes)})
}

export function createDrainageMeasurement(input={}){
 const appliedVolumeLiters=positive(input.appliedVolumeLiters,'appliedVolumeLiters'),drainedVolumeLiters=nonNegative(input.drainedVolumeLiters,'drainedVolumeLiters')
 if(drainedVolumeLiters>appliedVolumeLiters)throw new Error('drainedVolumeLiters no puede superar appliedVolumeLiters.')
 return deepFreeze({id:required(input.id,'id'),organizationId:required(input.organizationId,'organizationId'),siteId:required(input.siteId,'siteId'),sectorId:required(input.sectorId,'sectorId'),pulseId:text(input.pulseId),measuredAt:iso(input.measuredAt,'measuredAt'),source:enumValue(input.source,MEASUREMENT_SOURCES,'source'),appliedVolumeLiters,drainedVolumeLiters,drainagePercent:Number(((drainedVolumeLiters/appliedVolumeLiters)*100).toFixed(4)),inputEc:input.inputEc===undefined?null:nonNegative(input.inputEc,'inputEc'),drainEc:input.drainEc===undefined?null:nonNegative(input.drainEc,'drainEc'),inputPh:input.inputPh===undefined?null:nonNegative(input.inputPh,'inputPh'),drainPh:input.drainPh===undefined?null:nonNegative(input.drainPh,'drainPh')})
}

export function createFertigationProduct(input={}){
 const analysis=plainObject(input.analysis)?Object.fromEntries(Object.entries(input.analysis).map(([key,value])=>[required(key,'analysis.key'),nonNegative(value,`analysis.${key}`)])):{}
 return deepFreeze({id:required(input.id,'id'),organizationId:required(input.organizationId,'organizationId'),name:required(input.name,'name'),inventoryProductId:text(input.inventoryProductId),brand:text(input.brand),physicalForm:text(input.physicalForm),analysis,solubilityGramsPerLiter:input.solubilityGramsPerLiter===undefined?null:nonNegative(input.solubilityGramsPerLiter,'solubilityGramsPerLiter'),active:input.active!==false})
}

export function createFertigationFormula(input={}){
 const sourceItems=Array.isArray(input.items)?input.items:[]
 if(!sourceItems.length)throw new Error('La fórmula requiere al menos un producto.')
 const items=sourceItems.map(item=>deepFreeze({productId:required(item.productId,'productId'),tank:required(item.tank||'A','tank'),grams:positive(item.grams,'grams')}))
 const keys=items.map(item=>`${item.productId}:${item.tank}`)
 if(new Set(keys).size!==keys.length)throw new Error('La fórmula no puede repetir el mismo producto dentro del mismo tanque.')
 const id=required(input.id,'id'),formulaKey=text(input.formulaKey)||id,version=positiveInteger(input.version??1,'version')
 const validation=plainObject(input.validation)?{...input.validation}:{},status=text(input.status)||'DRAFT',approved=status==='Aprobada'||status==='APPROVED'
 if(approved&&(validation.valid!==true||(Array.isArray(validation.warnings)&&validation.warnings.length)))throw new Error('Una fórmula solo puede aprobarse con validación canónica válida y sin advertencias.')
 const createdAt=iso(input.createdAt||new Date().toISOString(),'createdAt'),approvedAt=input.approvedAt?iso(input.approvedAt,'approvedAt'):(approved?createdAt:'')
 const targetSnapshot=plainObject(input.targetSnapshot)?numericRecord(input.targetSnapshot,'targetSnapshot'):{}
 const productSnapshots=Array.isArray(input.productSnapshots)?input.productSnapshots.filter(plainObject).map(snapshot=>({...snapshot})):[]
 return deepFreeze({id,organizationId:required(input.organizationId,'organizationId'),siteId:required(input.siteId,'siteId'),formulaKey,version,supersedesFormulaId:text(input.supersedesFormulaId),name:required(input.name,'name'),stage:required(input.stage,'stage'),geneticId:text(input.geneticId),volumeLiters:positive(input.volumeLiters,'volumeLiters'),items,nutrientObjectiveId:text(input.nutrientObjectiveId),waterAnalysisId:text(input.waterAnalysisId),targetSnapshot,productSnapshots,validation,status,createdAt,approvedBy:text(input.approvedBy),approvedAt})
}

export function nextFertigationFormulaVersion(previous,input={}){
 if(!previous?.id||!previous?.organizationId||!previous?.siteId)throw new Error('La fórmula anterior es obligatoria.')
 return createFertigationFormula({...input,id:required(input.id,'id'),organizationId:previous.organizationId,siteId:previous.siteId,formulaKey:previous.formulaKey||previous.id,version:Number(previous.version||1)+1,supersedesFormulaId:previous.id,name:input.name||previous.name,stage:input.stage||previous.stage,geneticId:input.geneticId??previous.geneticId,volumeLiters:input.volumeLiters??previous.volumeLiters})
}

export function createFertigationPreparation(input={},formula){
 if(!formula?.id)throw new Error('La fórmula es obligatoria.')
 const status=enumValue(input.status||FERTIGATION_STATUSES.PENDING,FERTIGATION_STATUSES,'status')
 return deepFreeze({id:required(input.id,'id'),organizationId:formula.organizationId,siteId:formula.siteId,formulaId:formula.id,formulaKey:formula.formulaKey,formulaVersion:formula.version,volumeLiters:positive(input.volumeLiters??formula.volumeLiters,'volumeLiters'),status,items:formula.items.map(item=>({productId:item.productId,tank:item.tank,requiredGrams:item.grams,inventoryLotId:'',consumedQuantity:null,consumedUnit:'',unitCost:null,totalCost:null})),createdAt:iso(input.createdAt||new Date().toISOString(),'createdAt'),responsibleId:text(input.responsibleId)})
}

export function createFertigationApplication(input={},preparation){
 if(!preparation?.id)throw new Error('La preparación es obligatoria.')
 if(preparation.status!==FERTIGATION_STATUSES.PREPARED)throw new Error('La preparación debe estar PREPARED antes de aplicarse.')
 const volumeLiters=positive(input.volumeLiters,'volumeLiters')
 if(volumeLiters>preparation.volumeLiters)throw new Error('volumeLiters no puede superar el volumen preparado.')
 return deepFreeze({id:required(input.id,'id'),organizationId:preparation.organizationId,siteId:preparation.siteId,preparationId:preparation.id,formulaId:preparation.formulaId,formulaVersion:preparation.formulaVersion,sectorId:required(input.sectorId,'sectorId'),volumeLiters,source:enumValue(input.source,MEASUREMENT_SOURCES,'source'),appliedAt:iso(input.appliedAt,'appliedAt'),responsibleId:text(input.responsibleId),notes:text(input.notes)})
}
