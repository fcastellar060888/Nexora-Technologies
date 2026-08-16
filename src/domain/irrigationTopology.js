import{hydraulics}from'./irrigation.js'
import{IRRIGATION_EMITTER_KINDS,IRRIGATION_TARGET_TYPES}from'./irrigationMirfe.js'
import{irrigationMirfeRecordsForOrganization}from'./irrigationMirfeTenancy.js'
import{explicitOrganizationId}from'./organizationOwnership.js'

export const IRRIGATION_CALCULATION_MODES=Object.freeze({CANONICAL_TOPOLOGY:'CANONICAL_TOPOLOGY',LEGACY_BEDS:'LEGACY_BEDS'})

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const positive=(value,label)=>{const number=Number(value);if(!Number.isFinite(number)||number<=0)throw new Error(`${label} debe ser mayor que cero.`);return number}
const positiveInteger=(value,label)=>{const number=positive(value,label);if(!Number.isInteger(number))throw new Error(`${label} debe ser un entero positivo.`);return number}
const canonicalRecords=(state,collection,organizationId)=>list(state?.[collection]).filter(record=>explicitOrganizationId(record)===organizationId)

function unique(records,id,label){
 const matches=list(records).filter(record=>text(record?.id)===text(id))
 if(matches.length!==1)throw new Error(matches.length?`${label} tiene identidad duplicada dentro de la empresa activa.`:`${label} no existe en la empresa activa.`)
 return matches[0]
}

function activePosition(position){
 if(position?.active===false)return false
 const occupancy=text(position?.occupancyState).toUpperCase(),status=text(position?.status).toLocaleLowerCase()
 if(['EMPTY','BLOCKED','INACTIVE'].includes(occupancy))return false
 if(['vacía','vacia','inactiva','bloqueada','muerto','descartado'].includes(status))return false
 return true
}

function effectiveAt(assignment,instant){
 const from=Date.parse(assignment.validFrom),to=assignment.validTo?Date.parse(assignment.validTo):Infinity
 if(Number.isNaN(from)||Number.isNaN(to))throw new Error(`La vigencia de Assignment ${assignment.id} es inválida.`)
 return from<=instant&&instant<=to
}

function targetContext(state,assignment,organizationId,siteId){
 const beds=irrigationMirfeRecordsForOrganization(state,'beds',organizationId)
 const positions=irrigationMirfeRecordsForOrganization(state,'plantPositions',organizationId)
 if(assignment.targetType===IRRIGATION_TARGET_TYPES.POSITION){
  const position=unique(positions,assignment.targetId,'La Position objetivo'),bed=unique(beds,position.bedId||position.parentId,'La cama de la Position')
  if(text(position.siteId||bed.siteId)!==siteId)throw new Error('La Position objetivo pertenece a otra sede.')
  if(!activePosition(position))return{skip:true}
  const plants=Math.max(1,Number(position.plantsPerContainer)||1)
  if(Number(assignment.plantsServed)!==plants)throw new Error(`Assignment ${assignment.id} no coincide con las plantas activas de su Position.`)
  return{bedId:bed.id,houseId:text(bed.houseId),geneticIds:[text(position.geneticId||bed.geneticId)].filter(Boolean),plants}
 }
 if(assignment.targetType===IRRIGATION_TARGET_TYPES.BED){
  const bed=unique(beds,assignment.targetId,'La cama objetivo')
  if(text(bed.siteId)!==siteId)throw new Error('La cama objetivo pertenece a otra sede.')
  const activePositions=positions.filter(position=>text(position.bedId||position.parentId)===bed.id&&activePosition(position))
  const actualPlants=activePositions.length||Math.max(0,Number(bed.activePlants)||0)||Number(assignment.plantsServed)
  if(Number(assignment.plantsServed)!==actualPlants)throw new Error(`Assignment ${assignment.id} no coincide con las plantas activas de su cama.`)
  const geneticIds=[...new Set((activePositions.length?activePositions.map(position=>text(position.geneticId)): [text(bed.geneticId)]).filter(Boolean))]
  return{bedId:bed.id,houseId:text(bed.houseId),geneticIds,plants:actualPlants}
 }
 if(assignment.targetType===IRRIGATION_TARGET_TYPES.TRAY){
  const banks=irrigationMirfeRecordsForOrganization(state,'propagationBanks',organizationId).filter(bank=>text(bank.siteId)===siteId&&bank.active!==false&&list(bank.trays).some(tray=>text(tray.id)===assignment.targetId))
  if(banks.length!==1)throw new Error(banks.length?'La bandeja objetivo está duplicada dentro de la empresa activa.':'La bandeja objetivo no existe en la empresa activa.')
  const bank=banks[0],tray=unique(bank.trays,assignment.targetId,'La bandeja objetivo'),capacity=Math.max(0,Number(tray.quantity)||0)*Math.max(0,Number(tray.cellsPerTray)||0)
  if(capacity&&Number(assignment.plantsServed)>capacity)throw new Error(`Assignment ${assignment.id} supera la capacidad de la bandeja.`)
  const units=irrigationMirfeRecordsForOrganization(state,'propagationUnits',organizationId).filter(unit=>text(unit.bankId||unit.propagationBankId)===bank.id&&(!unit.trayId||text(unit.trayId)===assignment.targetId)&&activePosition(unit))
  if(units.length&&Number(assignment.plantsServed)!==units.length)throw new Error(`Assignment ${assignment.id} no coincide con las plantas activas de su bandeja.`)
  return{bedId:'',houseId:text(bank.houseId),geneticIds:[...new Set(units.map(unit=>text(unit.geneticId)).filter(Boolean))],plants:Number(assignment.plantsServed),trayId:tray.id}
 }
 throw new Error(`Target type no soportado en Assignment ${assignment.id}.`)
}

function validateEmitterCapacity(assignment,emitter,plants){
 const emitterCount=positiveInteger(assignment.emitterCount,'emitterCount'),plantsServed=positiveInteger(plants,'plantsServed')
 const plantsCapacity=emitterCount*positiveInteger(emitter.plantsPerEmitter,'plantsPerEmitter')
 if(plantsServed>plantsCapacity)throw new Error(`Assignment ${assignment.id} supera la capacidad de plantas del emisor.`)
 const outletCapacity=emitterCount*positiveInteger(emitter.outletCount,'outletCount')
 const requiredOutlets=plantsServed*positiveInteger(emitter.stakesPerPlant,'stakesPerPlant')
 if(requiredOutlets>outletCapacity)throw new Error(`Assignment ${assignment.id} no tiene suficientes salidas/estacas.`)
 return emitterCount
}

function sectorBreakdown(rows,sectors){
 const bySector=new Map()
 for(const row of rows){
  const current=bySector.get(row.sectorId)||{sectorId:row.sectorId,name:sectors.find(sector=>sector.id===row.sectorId)?.name||row.sectorId,plants:0,emitterCount:0,flowLitersPerHour:0,controlModes:new Set()}
  current.plants+=row.plants;current.emitterCount+=row.emitterCount;current.flowLitersPerHour+=row.flowLitersPerHour;current.controlModes.add(row.controlMode);bySector.set(row.sectorId,current)
 }
 return[...bySector.values()].map(({controlModes,...item})=>({...item,controlMode:controlModes.size===1?[...controlModes][0]:'MIXED'}))
}

function legacyResult(rows,apps,minutes,tank){
 const result=hydraulics(rows,apps,minutes,tank)
 return{...result,calculationMode:IRRIGATION_CALCULATION_MODES.LEGACY_BEDS,assignmentCount:0,sectorCount:0,emitterCount:0,perPlantFlowLitersPerHour:result.plants?result.flow/result.plants:0,topologySnapshot:null}
}

export function irrigationHydraulicsForPlan(state,{organizationId,siteId,houseId='',sectorId='',geneticId='',at=new Date().toISOString(),apps,minutes,tank,legacyRows=[]}={}){
 const tenant= text(organizationId),site=text(siteId),selectedHouse=text(houseId),selectedSector=text(sectorId),selectedGenetic=text(geneticId)
 if(!tenant)throw new Error('organizationId es obligatorio.')
 if(!site)throw new Error('siteId es obligatorio.')
 const applicationCount=positive(apps,'apps'),pulseMinutes=positive(minutes,'minutes'),tankLiters=positive(tank,'tank')
 const instant=Date.parse(at)
 if(Number.isNaN(instant))throw new Error('at debe ser una fecha válida.')
 const sites=irrigationMirfeRecordsForOrganization(state,'sites',tenant)
 if(Array.isArray(state?.sites))unique(sites,site,'La sede')
 const houses=irrigationMirfeRecordsForOrganization(state,'houses',tenant)
 if(selectedHouse){const house=unique(houses,selectedHouse,'La nave');if(text(house.siteId)!==site)throw new Error('La nave seleccionada pertenece a otra sede.')}
 const genetics=irrigationMirfeRecordsForOrganization(state,'genetics',tenant)
 if(selectedGenetic&&Array.isArray(state?.genetics))unique(genetics,selectedGenetic,'La genética')
 const siteAssignments=canonicalRecords(state,'irrigationAssignments',tenant).filter(assignment=>assignment.active!==false&&text(assignment.siteId)===site)
 if(!siteAssignments.length)return legacyResult(legacyRows,applicationCount,pulseMinutes,tankLiters)
 const assignments=siteAssignments.filter(assignment=>effectiveAt(assignment,instant))
 if(!assignments.length)throw new Error('La topología canónica existe, pero no tiene Assignments vigentes para la fecha del plan.')
 const emitters=canonicalRecords(state,'irrigationEmitters',tenant),sectors=canonicalRecords(state,'irrigationSectors',tenant)
 const rows=[]
 for(const assignment of assignments){
  if(selectedSector&&assignment.sectorId!==selectedSector)continue
  const emitter=unique(emitters,assignment.emitterId,'El emisor'),sector=unique(sectors,assignment.sectorId,'El sector')
  if(text(emitter.siteId)!==site||text(sector.siteId)!==site)throw new Error(`Assignment ${assignment.id} cruza sedes.`)
  if(emitter.active===false||sector.active===false)throw new Error(`Assignment ${assignment.id} referencia topología inactiva.`)
  const target=targetContext(state,assignment,tenant,site)
  if(target.skip)continue
  if(text(sector.houseId)&&target.houseId&&text(sector.houseId)!==target.houseId)throw new Error(`Assignment ${assignment.id} cruza la nave de su sector.`)
  const effectiveHouse=text(sector.houseId||target.houseId)
  if(selectedHouse&&effectiveHouse!==selectedHouse)continue
  if(selectedGenetic){
   if(!target.geneticIds.length)throw new Error(`Assignment ${assignment.id} no permite demostrar la genética objetivo.`)
   if(target.geneticIds.length>1)throw new Error(`Assignment ${assignment.id} cubre varias genéticas; requiere asignación por Position.`)
   if(target.geneticIds[0]!==selectedGenetic)continue
  }
  const emitterCount=validateEmitterCapacity(assignment,emitter,target.plants),flowLitersPerHour=emitterCount*positive(emitter.flowLitersPerHour,'flowLitersPerHour')
  rows.push({assignmentId:assignment.id,sectorId:sector.id,emitterId:emitter.id,emitterKind:emitter.kind,targetType:assignment.targetType,targetId:assignment.targetId,bedId:target.bedId||'',trayId:target.trayId||'',plants:target.plants,emitterCount,outletCount:emitterCount*Number(emitter.outletCount),stakesPerPlant:Number(emitter.stakesPerPlant),flowLitersPerHour,perPlantFlowLitersPerHour:flowLitersPerHour/target.plants,controlMode:emitter.kind===IRRIGATION_EMITTER_KINDS.MANUAL||!text(emitter.controllerDeviceId)?'MANUAL':'AUTOMATIC'})
 }
 if(!rows.length)throw new Error('La topología canónica no tiene Assignments aplicables a los filtros del plan.')
 const targetKeys=new Set(),bedTargets=new Set(),positionBeds=new Set()
 for(const row of rows){
  const key=`${row.targetType}:${row.targetId}`
  if(targetKeys.has(key))throw new Error(`La topología duplica el target ${key}.`)
  targetKeys.add(key)
  if(row.targetType===IRRIGATION_TARGET_TYPES.BED)bedTargets.add(row.bedId)
  if(row.targetType===IRRIGATION_TARGET_TYPES.POSITION)positionBeds.add(row.bedId)
 }
 for(const bedId of bedTargets)if(positionBeds.has(bedId))throw new Error(`La topología mezcla Assignment de cama y Position en ${bedId}.`)
 const plants=rows.reduce((sum,row)=>sum+row.plants,0),flow=rows.reduce((sum,row)=>sum+row.flowLitersPerHour,0),pulse=flow*pulseMinutes/60,daily=pulse*applicationCount
 const loads=daily?Math.ceil(daily/tankLiters):0,last=daily?(daily%tankLiters||tankLiters):0,breakdown=sectorBreakdown(rows,sectors)
 return{plants,flow,pulse,daily,loads,last,calculationMode:IRRIGATION_CALCULATION_MODES.CANONICAL_TOPOLOGY,assignmentCount:rows.length,sectorCount:breakdown.length,emitterCount:rows.reduce((sum,row)=>sum+row.emitterCount,0),perPlantFlowLitersPerHour:plants?flow/plants:0,topologySnapshot:{at:new Date(instant).toISOString(),assignmentIds:rows.map(row=>row.assignmentId),sectorIds:breakdown.map(item=>item.sectorId),emitterIds:[...new Set(rows.map(row=>row.emitterId))],rows,sectorBreakdown:breakdown}}
}
