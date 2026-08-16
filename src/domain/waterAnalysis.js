const text=value=>String(value??'').trim()
const required=(value,label)=>{const normalized=text(value);if(!normalized)throw new Error(`${label} es obligatorio.`);return normalized}
const iso=(value,label)=>{const normalized=required(value,label),time=Date.parse(normalized);if(Number.isNaN(time))throw new Error(`${label} debe ser una fecha válida.`);return new Date(time).toISOString()}
const dateOnly=(value,label)=>{const normalized=required(value,label),time=Date.parse(`${normalized}T00:00:00.000Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(normalized)||Number.isNaN(time)||new Date(time).toISOString().slice(0,10)!==normalized)throw new Error(`${label} debe ser una fecha civil válida.`);return normalized}
const plainObject=value=>value&&typeof value==='object'&&!Array.isArray(value)
const stable=value=>Number(Number(value).toFixed(9))

function deepFreeze(value){
 if(!value||typeof value!=='object'||Object.isFrozen(value))return value
 Object.values(value).forEach(deepFreeze)
 return Object.freeze(value)
}

export const WATER_ANALYSIS_STATUSES=Object.freeze({PENDING:'Pendiente',PARTIAL:'Parcial',CURRENT:'Vigente'})

export const WATER_ANALYTES=Object.freeze({
 ec:Object.freeze({label:'EC',unit:'mS/cm',basis:'WATER'}),
 ph:Object.freeze({label:'pH',unit:'pH',basis:'WATER'}),
 alkalinity:Object.freeze({label:'Alcalinidad',unit:'mg/L',basis:'WATER'}),
 hco3:Object.freeze({label:'HCO₃',unit:'mg/L',basis:'WATER'}),
 na:Object.freeze({label:'Na',unit:'mg/L',basis:'WATER'}),
 cl:Object.freeze({label:'Cl',unit:'mg/L',basis:'WATER'}),
 nNo3:Object.freeze({label:'N-NO₃',unit:'mg/L',basis:'WATER'}),
 nNh4:Object.freeze({label:'N-NH₄',unit:'mg/L',basis:'WATER'}),
 p:Object.freeze({label:'P',unit:'mg/L',basis:'WATER'}),
 k:Object.freeze({label:'K',unit:'mg/L',basis:'WATER'}),
 ca:Object.freeze({label:'Ca',unit:'mg/L',basis:'WATER'}),
 mg:Object.freeze({label:'Mg',unit:'mg/L',basis:'WATER'}),
 s:Object.freeze({label:'S',unit:'mg/L',basis:'WATER'}),
 fe:Object.freeze({label:'Fe',unit:'mg/L',basis:'WATER'}),
 mn:Object.freeze({label:'Mn',unit:'mg/L',basis:'WATER'}),
 zn:Object.freeze({label:'Zn',unit:'mg/L',basis:'WATER'}),
 b:Object.freeze({label:'B',unit:'mg/L',basis:'WATER'}),
 cu:Object.freeze({label:'Cu',unit:'mg/L',basis:'WATER'}),
 mo:Object.freeze({label:'Mo',unit:'mg/L',basis:'WATER'}),
 si:Object.freeze({label:'Si',unit:'mg/L',basis:'WATER'})
})

export const WATER_ANALYTE_KEYS=Object.freeze(Object.keys(WATER_ANALYTES))
export const WATER_FORMULATION_ANALYTES=Object.freeze(['nNo3','nNh4','p','k','ca','mg','s'])

function analyte(value,label='analyte'){
 const key=required(value,label)
 if(!Object.prototype.hasOwnProperty.call(WATER_ANALYTES,key))throw new Error(`${label} no pertenece al panel de agua canónico.`)
 return key
}

function expectedAnalytes(input,previous){
 const source=Array.isArray(input.expectedAnalytes)?input.expectedAnalytes:(Array.isArray(previous?.expectedAnalytes)?previous.expectedAnalytes:WATER_ANALYTE_KEYS)
 if(!source.length)throw new Error('expectedAnalytes debe contener al menos un analito.')
 const normalized=source.map((value,index)=>analyte(value,`expectedAnalytes[${index}]`))
 if(new Set(normalized).size!==normalized.length)throw new Error('expectedAnalytes no puede contener duplicados.')
 return WATER_ANALYTE_KEYS.filter(key=>normalized.includes(key))
}

function resultValue(value,key){
 const number=Number(value)
 if(!Number.isFinite(number)||number<0)throw new Error(`results.${key}.value debe ser un número no negativo.`)
 if(key==='ph'&&number>14)throw new Error('results.ph.value debe estar entre 0 y 14.')
 return stable(number)
}

function inputResultEntries(input){
 if(Array.isArray(input.results))return input.results.map((entry,index)=>{
  if(!plainObject(entry))throw new Error(`results[${index}] debe ser un objeto.`)
  return[analyte(entry.analyte,`results[${index}].analyte`),entry]
 })
 if(plainObject(input.results))return Object.entries(input.results).map(([key,value])=>[analyte(key,'results.key'),plainObject(value)?value:{value}])
 const entries=[]
 for(const key of WATER_ANALYTE_KEYS)if(Object.prototype.hasOwnProperty.call(input,key)&&input[key]!==''&&input[key]!==null&&input[key]!==undefined)entries.push([key,{value:input[key]}])
 return entries
}

function canonicalResult(key,entry,input){
 const definition=WATER_ANALYTES[key]
 return deepFreeze({
  analyte:key,
  value:resultValue(entry.value,key),
  unit:required(entry.unit||definition.unit,`results.${key}.unit`),
  methodId:required(entry.methodId||input.analyticalMethodId,`results.${key}.methodId`),
  basis:required(entry.basis||definition.basis,`results.${key}.basis`)
 })
}

export function waterAnalysisResults(record={}){
 if(Array.isArray(record.results))return record.results.map(entry=>canonicalResult(analyte(entry?.analyte),entry,{analyticalMethodId:entry?.methodId||'LEGACY_UNSPECIFIED'}))
 const entries=[]
 for(const key of WATER_ANALYTE_KEYS)if(Object.prototype.hasOwnProperty.call(record,key)&&record[key]!==''&&record[key]!==null&&record[key]!==undefined)entries.push(canonicalResult(key,{value:record[key],methodId:record.analyticalMethodId||'LEGACY_UNSPECIFIED'},{}))
 return entries
}

function resultMap(record){return new Map(waterAnalysisResults(record).map(result=>[result.analyte,result]))}

function sameExpected(left,right){return left.length===right.length&&left.every((value,index)=>value===right[index])}

export function createWaterAnalysisVersion(input={},previous=null){
 const id=required(input.id,'id'),organizationId=required(input.organizationId,'organizationId'),siteId=required(input.siteId,'siteId')
 if(previous){
  if(!previous.id)throw new Error('El análisis anterior no tiene identidad.')
  if(id===previous.id)throw new Error('Una nueva versión requiere un id diferente.')
  if(previous.organizationId!==organizationId||previous.siteId!==siteId)throw new Error('La nueva versión debe conservar empresa y sede.')
 }
 const previousCanonical=previous?.schemaVersion===1
 const analysisKey=previous?text(previous.analysisKey)||previous.id:text(input.analysisKey)||id
 if(previous&&text(input.analysisKey)&&text(input.analysisKey)!==analysisKey)throw new Error('La nueva versión debe conservar analysisKey.')
 if(!previous&&text(input.supersedesWaterAnalysisId))throw new Error('supersedesWaterAnalysisId requiere un análisis anterior resuelto.')
 if(previous&&text(input.supersedesWaterAnalysisId)&&text(input.supersedesWaterAnalysisId)!==previous.id)throw new Error('supersedesWaterAnalysisId no coincide con el análisis anterior.')
 const laboratoryId=required(input.laboratoryId??previous?.laboratoryId,'laboratoryId')
 const laboratoryName=required(input.laboratoryName??input.laboratory??previous?.laboratoryName??previous?.laboratory,'laboratoryName')
 const sampleId=required(input.sampleId??previous?.sampleId,'sampleId')
 const samplePoint=required(input.samplePoint??previous?.samplePoint,'samplePoint')
 const sampleType=required(input.sampleType??previous?.sampleType??'SOURCE_WATER','sampleType')
 const sampledAt=iso(input.sampledAt??previous?.sampledAt,'sampledAt')
 if(previousCanonical){
  if(previous.laboratoryId!==laboratoryId)throw new Error('La nueva versión debe conservar laboratoryId.')
  if(previous.sampleId!==sampleId||previous.samplePoint!==samplePoint||previous.sampleType!==sampleType||previous.sampledAt!==sampledAt)throw new Error('La nueva versión debe conservar la identidad de la muestra.')
 }
 const expected=expectedAnalytes(input,previous)
 if(previousCanonical&&!sameExpected(previous.expectedAnalytes,expected))throw new Error('La nueva versión debe conservar expectedAnalytes.')
 const merged=previous?resultMap(previous):new Map(),incoming=inputResultEntries(input),seen=new Set()
 for(const[key,entry]of incoming){
  if(seen.has(key))throw new Error(`results contiene ${key} más de una vez.`)
  seen.add(key)
  if(!expected.includes(key))throw new Error(`results.${key} no pertenece al panel esperado.`)
  merged.set(key,canonicalResult(key,entry,input))
 }
 for(const key of [...merged.keys()])if(!expected.includes(key))merged.delete(key)
 const results=WATER_ANALYTE_KEYS.filter(key=>merged.has(key)).map(key=>merged.get(key)),missingAnalytes=expected.filter(key=>!merged.has(key))
 const status=text(input.status)||WATER_ANALYSIS_STATUSES.PENDING
 if(!Object.values(WATER_ANALYSIS_STATUSES).includes(status))throw new Error('status no pertenece al catálogo canónico de análisis de agua.')
 if(status===WATER_ANALYSIS_STATUSES.CURRENT&&missingAnalytes.length)throw new Error(`Un análisis Vigente requiere el panel completo; faltan: ${missingAnalytes.join(', ')}.`)
 if(status===WATER_ANALYSIS_STATUSES.PARTIAL&&(!results.length||!missingAnalytes.length))throw new Error('Un análisis Parcial requiere resultados y analitos pendientes.')
 const reportedAt=iso(input.reportedAt||input.createdAt||new Date().toISOString(),'reportedAt')
 if(Date.parse(sampledAt)>Date.parse(reportedAt))throw new Error('sampledAt no puede ser posterior a reportedAt.')
 const aliases=Object.fromEntries(results.map(result=>[result.analyte,result.value]))
 const version=previous?Number(previous.version||1)+1:1
 if(!Number.isSafeInteger(version)||version<=0)throw new Error('La versión del análisis no es válida.')
 const completeness={complete:missingAnalytes.length===0,resultCount:results.length,expectedCount:expected.length,missingAnalytes}
 return deepFreeze({
  schemaVersion:1,id,organizationId,siteId,analysisKey,version,supersedesWaterAnalysisId:previous?.id||'',
  laboratoryId,laboratoryName,laboratory:laboratoryName,sampleId,samplePoint,sampleType,sampledAt,
  analyticalMethodId:text(input.analyticalMethodId)||text(previous?.analyticalMethodId),expectedAnalytes:expected,results,completeness,
  status,date:dateOnly(text(input.date)||reportedAt.slice(0,10),'date'),reportedAt,responsible:text(input.responsible),notes:text(input.notes),...aliases
 })
}

export function assertWaterSampleIdentity(records=[],candidate){
 if(!candidate?.sampleId)return candidate
 for(const record of Array.isArray(records)?records:[]){
  if(record?.organizationId!==candidate.organizationId||text(record.sampleId)!==candidate.sampleId)continue
  if(record.siteId!==candidate.siteId||text(record.samplePoint)!==candidate.samplePoint||text(record.sampleType)!==candidate.sampleType||text(record.sampledAt)!==candidate.sampledAt)throw new Error('sampleId ya identifica otra muestra dentro del tenant.')
 }
 return candidate
}

function recordTime(record){const parsed=Date.parse(record.reportedAt||record.createdAt||record.date||'');return Number.isNaN(parsed)?0:parsed}

export function currentWaterAnalysisForSite(records=[],{organizationId,siteId,requiredAnalytes=[]}={}){
 const owner=required(organizationId,'organizationId'),site=required(siteId,'siteId'),requiredKeys=requiredAnalytes.map((value,index)=>analyte(value,`requiredAnalytes[${index}]`))
 const seenIds=new Set(),seenVersions=new Set(),candidates=[],scoped=(Array.isArray(records)?records:[]).filter(record=>record?.organizationId===owner&&record?.siteId===site)
 for(const record of scoped){
  const id=required(record.id,'waterAnalysis.id'),lineage=text(record.analysisKey)||id,version=Number(record.version||1),versionKey=JSON.stringify([lineage,version])
  if(seenIds.has(id))throw new Error('El historial de agua contiene identidad duplicada dentro del tenant.')
  if(!Number.isSafeInteger(version)||version<=0||seenVersions.has(versionKey))throw new Error('El historial de agua contiene una versión duplicada o inválida dentro del lineage.')
  seenIds.add(id);seenVersions.add(versionKey)
  if(record.status!==WATER_ANALYSIS_STATUSES.CURRENT)continue
  const available=new Set(waterAnalysisResults(record).map(result=>result.analyte))
  if(record.schemaVersion===1&&record.completeness?.complete!==true)continue
  if(requiredKeys.some(key=>!available.has(key)))continue
  candidates.push(record)
 }
 candidates.sort((left,right)=>recordTime(left)-recordTime(right)||Number(left.version||1)-Number(right.version||1)||String(left.id).localeCompare(String(right.id)))
 return candidates.at(-1)||null
}

export function effectiveWaterAnalysisStatus(record,records=[]){
 if(record?.status!==WATER_ANALYSIS_STATUSES.CURRENT)return record?.status||''
 const current=currentWaterAnalysisForSite(records,{organizationId:record.organizationId,siteId:record.siteId})
 return current?.id===record.id?WATER_ANALYSIS_STATUSES.CURRENT:'Histórico'
}

function comparisonScope(left,right){
 if(!left?.id||!right?.id)throw new Error('Se requieren dos análisis con identidad.')
 if(left.id===right.id)throw new Error('Selecciona dos análisis diferentes.')
 if(left.organizationId!==right.organizationId)throw new Error('Los análisis deben pertenecer a la misma organización.')
 if(left.siteId!==right.siteId)throw new Error('Los análisis deben pertenecer a la misma sede.')
 if(!text(left.samplePoint)||left.samplePoint!==right.samplePoint)throw new Error('Los análisis deben corresponder al mismo punto de muestreo.')
 if(!text(left.sampleType)||left.sampleType!==right.sampleType)throw new Error('Los análisis deben corresponder al mismo tipo de muestra.')
}

export function compareWaterAnalyses(left,right){
 comparisonScope(left,right)
 const leftResults=resultMap(left),rightResults=resultMap(right),rows=[],incompatible=[]
 for(const key of WATER_ANALYTE_KEYS){
  const before=leftResults.get(key),after=rightResults.get(key)
  if(!before||!after)continue
  const mismatches=['unit','methodId','basis'].filter(field=>before[field]!==after[field])
  if(mismatches.length){incompatible.push({analyte:key,reason:`No coincide ${mismatches.join(', ')}.`});continue}
  const delta=stable(after.value-before.value)
  rows.push({analyte:key,label:WATER_ANALYTES[key].label,unit:after.unit,methodId:after.methodId,basis:after.basis,before:before.value,after:after.value,delta,deltaPercent:before.value===0?null:stable(delta/before.value*100)})
 }
 if(!rows.length)throw new Error('Los análisis no tienen resultados técnicamente comparables.')
 return deepFreeze({organizationId:left.organizationId,siteId:left.siteId,samplePoint:left.samplePoint,sampleType:left.sampleType,beforeAnalysisId:left.id,afterAnalysisId:right.id,rows,incompatible})
}
