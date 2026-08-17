import{irrigationMirfeRecordOrganizationId}from'../../domain/irrigationMirfeTenancy.js'
import{passportIndicator,passportRelationship}from'./passportDomainSources.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const finite=value=>Number.isFinite(Number(value))?Number(value):0
const uniqueById=items=>[...new Map(items.filter(item=>text(item?.id)).map(item=>[text(item.id),item])).values()]

function declaredOrganizationId(item){return text(item?.organizationId||item?.companyId)}
function recordsFor(state,collection,organizationId,{matches=()=>true,label=collection}={}){
 const accepted=[]
 for(const item of list(state?.[collection])){
  if(!matches(item))continue
  const resolved=irrigationMirfeRecordOrganizationId(state,collection,item)
  if(resolved===organizationId){accepted.push(item);continue}
  if(declaredOrganizationId(item)===organizationId&&!resolved)throw new Error(`${label} tiene ownership ambiguo: el sector de riego pertenece a otra empresa o no existe en la empresa de la planta, o alguna referencia estructural es extranjera`)
 }
 return accepted
}
function referenceFor(state,collection,id,organizationId,label){
 const key=text(id)
 if(!key)return null
 const candidates=list(state?.[collection]).filter(item=>text(item?.id)===key)
 const matches=candidates.filter(item=>irrigationMirfeRecordOrganizationId(state,collection,item)===organizationId)
 if(matches.length>1)throw new Error(`${label} es ambiguo dentro de la empresa activa`)
 if(matches.length===1)return matches[0]
 if(candidates.length)throw new Error(`${label} pertenece a otra empresa o no tiene ownership inequívoco`)
 throw new Error(`${label} no existe en la empresa de la planta`)
}
function targetMatches(assignment,plant,location){
 const type=text(assignment?.targetType),targetId=text(assignment?.targetId)
 if(type==='POSITION')return targetId===text(plant?.id)
 if(type==='BED')return targetId===text(location?.bed?.id)
 if(type==='TRAY')return Boolean(text(plant?.trayId))&&targetId===text(plant.trayId)
 return false
}
function inWindow(assignment,occurredAt){
 const time=Date.parse(occurredAt),from=Date.parse(assignment?.validFrom),to=assignment?.validTo?Date.parse(assignment.validTo):Infinity
 if(Number.isNaN(time))return false
 return(Number.isNaN(from)||time>=from)&&(to===Infinity||(!Number.isNaN(to)&&time<=to))
}
function occursForSector(windowsBySector,sectorId,occurredAt){return list(windowsBySector.get(text(sectorId))).some(assignment=>inWindow(assignment,occurredAt))}
function applicationMatches(application,location,sectorIds){
 const sectorId=text(application?.sectorId)
 if(sectorId)return sectorIds.has(sectorId)
 const houseId=text(application?.houseId)
 return Boolean(houseId)&&houseId===text(location?.house?.id)
}
function safeDate(value){return Number.isNaN(Date.parse(value))?null:new Date(value).toISOString()}
function sum(items,valueFor){return Number(items.reduce((total,item)=>total+finite(valueFor(item)),0).toFixed(4))}

export function projectPlantIrrigationMirfe(state,{plant,location,organizationId}={}){
 const assignments=recordsFor(state,'irrigationAssignments',organizationId,{matches:item=>targetMatches(item,plant,location),label:'La asignación de riego'})
 const sectors=[],emitters=[],windowsBySector=new Map()
 for(const assignment of assignments){
  const sector=referenceFor(state,'irrigationSectors',assignment.sectorId,organizationId,'El sector de riego')
  const emitter=referenceFor(state,'irrigationEmitters',assignment.emitterId,organizationId,'El emisor de riego')
  sectors.push(sector);emitters.push(emitter)
  const windows=windowsBySector.get(text(sector.id))||[];windows.push(assignment);windowsBySector.set(text(sector.id),windows)
 }
 const sectorIds=new Set([...windowsBySector.keys()])
 const pulses=recordsFor(state,'irrigationPulses',organizationId,{matches:item=>sectorIds.has(text(item.sectorId))&&occursForSector(windowsBySector,item.sectorId,item.startedAt),label:'El pulso de riego'})
 const pulseIds=new Set(pulses.map(item=>text(item.id)))
 const measurements=recordsFor(state,'irrigationMeasurements',organizationId,{matches:item=>item.pulseId?pulseIds.has(text(item.pulseId)):sectorIds.has(text(item.sectorId))&&occursForSector(windowsBySector,item.sectorId,item.measuredAt),label:'La medición de riego'})
 const drainageMeasurements=recordsFor(state,'drainageMeasurements',organizationId,{matches:item=>item.pulseId?pulseIds.has(text(item.pulseId)):sectorIds.has(text(item.sectorId))&&occursForSector(windowsBySector,item.sectorId,item.measuredAt),label:'La medición de drenaje'})
 const applications=recordsFor(state,'irrigationApplications',organizationId,{matches:item=>applicationMatches(item,location,sectorIds),label:'La aplicación de fertirriego'})
 const preparations=[],formulas=[],lotEvidence=[]
 for(const application of applications){
  const preparation=referenceFor(state,'tankPreparations',application.preparationId,organizationId,'La preparación de fertirriego')
  if(preparation)preparations.push(preparation)
  const formulaId=text(preparation?.formulationId||preparation?.formulaId||application.formulationId||application.formulaId)
  if(formulaId)formulas.push(referenceFor(state,'formulations',formulaId,organizationId,'La fórmula de fertirriego'))
  for(const item of list(preparation?.items))if(text(item?.lotId)){
   const lot=referenceFor(state,'inventoryLots',item.lotId,organizationId,'El lote de inventario consumido')
   lotEvidence.push(Object.freeze({lot,preparationId:text(preparation.id),itemId:text(item.id),nutrientProductId:text(item.nutrientProductId||item.productId),inventoryProductId:text(item.inventoryProductId),tank:text(item.tank),consumedQuantity:finite(item.consumedQuantity),consumedUnit:text(item.consumedUnit),cost:finite(item.cost??item.totalCost)}))
  }
 }
 const groupedLots=new Map()
 for(const evidence of lotEvidence){const key=text(evidence.lot.id),current=groupedLots.get(key)||{lot:evidence.lot,uses:[]};current.uses.push(evidence);groupedLots.set(key,current)}
 const inventoryLots=[...groupedLots.values()].map(item=>Object.freeze({lot:item.lot,uses:Object.freeze(item.uses)}))
 const uniqueAssignments=uniqueById(assignments),uniqueSectors=uniqueById(sectors),uniqueEmitters=uniqueById(emitters),uniquePulses=uniqueById(pulses),uniqueMeasurements=uniqueById(measurements),uniqueDrainage=uniqueById(drainageMeasurements),uniqueApplications=uniqueById(applications),uniquePreparations=uniqueById(preparations),uniqueFormulas=uniqueById(formulas)
 const summary=Object.freeze({
  assignmentIds:Object.freeze(uniqueAssignments.map(item=>text(item.id))),sectorIds:Object.freeze(uniqueSectors.map(item=>text(item.id))),emitterIds:Object.freeze(uniqueEmitters.map(item=>text(item.id))),pulseIds:Object.freeze(uniquePulses.map(item=>text(item.id))),measurementIds:Object.freeze(uniqueMeasurements.map(item=>text(item.id))),drainageMeasurementIds:Object.freeze(uniqueDrainage.map(item=>text(item.id))),applicationIds:Object.freeze(uniqueApplications.map(item=>text(item.id))),preparationIds:Object.freeze(uniquePreparations.map(item=>text(item.id))),formulaIds:Object.freeze(uniqueFormulas.map(item=>text(item.id))),inventoryLotIds:Object.freeze(inventoryLots.map(item=>text(item.lot.id))),actualIrrigationVolumeLiters:sum(uniquePulses,item=>item.actualVolumeLiters),fertigationAppliedVolumeLiters:sum(uniqueApplications,item=>item.volumeLiters??item.volumeL),drainageVolumeLiters:sum(uniqueDrainage,item=>item.drainedVolumeLiters)
 })
 return Object.freeze({assignments:Object.freeze(uniqueAssignments),sectors:Object.freeze(uniqueSectors),emitters:Object.freeze(uniqueEmitters),pulses:Object.freeze(uniquePulses),measurements:Object.freeze(uniqueMeasurements),drainageMeasurements:Object.freeze(uniqueDrainage),applications:Object.freeze(uniqueApplications),preparations:Object.freeze(uniquePreparations),formulas:Object.freeze(uniqueFormulas),inventoryLots:Object.freeze(inventoryLots),summary})
}

export function projectIrrigationMirfeRelationships(projection,organizationId){
 const tenant={targetOrganizationId:organizationId},relationships=[]
 for(const item of projection?.assignments||[])relationships.push(passportRelationship('irrigated_by_assignment','irrigation.assignment',item.id,item.id,{...tenant,sectorId:text(item.sectorId),emitterId:text(item.emitterId),physicalTargetType:text(item.targetType),physicalTargetId:text(item.targetId),emitterCount:finite(item.emitterCount),plantsServed:finite(item.plantsServed),validFrom:safeDate(item.validFrom),validTo:safeDate(item.validTo)}))
 for(const item of projection?.sectors||[])relationships.push(passportRelationship('served_by_irrigation_sector','irrigation.sector',item.id,item.name||item.id,{...tenant,houseId:text(item.houseId)||null,zoneId:text(item.zoneId)||null}))
 for(const item of projection?.emitters||[])relationships.push(passportRelationship('served_by_irrigation_emitter','irrigation.emitter',item.id,item.name||item.id,{...tenant,kind:text(item.kind),flowLitersPerHour:finite(item.flowLitersPerHour),outletCount:finite(item.outletCount),plantsPerEmitter:finite(item.plantsPerEmitter)}))
 for(const item of projection?.pulses||[])relationships.push(passportRelationship('received_irrigation_pulse','irrigation.pulse',item.id,`Pulso ${text(item.id)}`,{...tenant,sectorId:text(item.sectorId),source:text(item.source),status:text(item.status),startedAt:safeDate(item.startedAt),completedAt:safeDate(item.completedAt),plannedVolumeLiters:finite(item.plannedVolumeLiters),actualVolumeLiters:item.actualVolumeLiters===null||item.actualVolumeLiters===undefined?null:finite(item.actualVolumeLiters),durationSeconds:finite(item.durationSeconds),deviceId:text(item.deviceId)||null}))
 for(const item of projection?.measurements||[])relationships.push(passportRelationship('has_irrigation_measurement','irrigation.measurement',item.id,`Medición ${text(item.id)}`,{...tenant,sectorId:text(item.sectorId),pulseId:text(item.pulseId)||null,measuredAt:safeDate(item.measuredAt),source:text(item.source),deviceId:text(item.deviceId)||null,values:item.values&&typeof item.values==='object'?{...item.values}:{},units:item.units&&typeof item.units==='object'?{...item.units}:{}}))
 for(const item of projection?.drainageMeasurements||[])relationships.push(passportRelationship('has_drainage_measurement','irrigation.drainage',item.id,`Drenaje ${text(item.id)}`,{...tenant,sectorId:text(item.sectorId),pulseId:text(item.pulseId)||null,measuredAt:safeDate(item.measuredAt),source:text(item.source),appliedVolumeLiters:finite(item.appliedVolumeLiters),drainedVolumeLiters:finite(item.drainedVolumeLiters),drainagePercent:finite(item.drainagePercent),inputEc:item.inputEc??null,drainEc:item.drainEc??null,inputPh:item.inputPh??null,drainPh:item.drainPh??null}))
 for(const item of projection?.applications||[])relationships.push(passportRelationship('received_fertigation_application','mirfe.fertigation.application',item.id,`Aplicación ${text(item.id)}`,{...tenant,preparationId:text(item.preparationId),formulaId:text(item.formulationId||item.formulaId),formulaVersion:finite(item.formulaVersion),sectorId:text(item.sectorId)||null,houseId:text(item.houseId)||null,volumeLiters:finite(item.volumeLiters??item.volumeL),appliedAt:safeDate(item.appliedAt||item.createdAt||item.date),status:text(item.status)||null}))
 for(const item of projection?.preparations||[])relationships.push(passportRelationship('fertigation_from_preparation','mirfe.fertigation.preparation',item.id,`Preparación ${text(item.id)}`,{...tenant,formulaId:text(item.formulationId||item.formulaId),formulaKey:text(item.formulaKey),formulaVersion:finite(item.formulaVersion),volumeLiters:finite(item.volumeLiters??item.volumeL),status:text(item.status),totalCost:finite(item.totalCost),preparedAt:safeDate(item.preparedAt),appliedAt:safeDate(item.appliedAt)}))
 for(const item of projection?.formulas||[])relationships.push(passportRelationship('uses_fertigation_formula','mirfe.fertigation.formula',item.id,`${item.name||item.id}${item.version?` v${item.version}`:''}`,{...tenant,formulaKey:text(item.formulaKey||item.id),version:finite(item.version||1),stage:text(item.stage),geneticId:text(item.geneticId)||null,waterAnalysisId:text(item.waterAnalysisId)||null,nutrientObjectiveId:text(item.nutrientObjectiveId)||null,status:text(item.status)}))
 for(const entry of projection?.inventoryLots||[])relationships.push(passportRelationship('consumed_inventory_lot','inventory.lot',entry.lot.id,entry.lot.code||entry.lot.lotCode||entry.lot.batchCode||entry.lot.id,{...tenant,productId:text(entry.lot.productId)||null,siteId:text(entry.lot.siteId)||null,uses:entry.uses.map(use=>({preparationId:use.preparationId,itemId:use.itemId||null,nutrientProductId:use.nutrientProductId||null,inventoryProductId:use.inventoryProductId||null,tank:use.tank||null,consumedQuantity:use.consumedQuantity,consumedUnit:use.consumedUnit||null,cost:use.cost}))}))
 return Object.freeze(relationships)
}

export function projectIrrigationMirfeIndicators(projection){
 const summary=projection?.summary||{}
 return Object.freeze([
  passportIndicator('irrigation_assignments',list(summary.assignmentIds).length,'assignments'),passportIndicator('irrigation_pulses',list(summary.pulseIds).length,'pulses'),passportIndicator('irrigation_volume_liters',finite(summary.actualIrrigationVolumeLiters),'L'),passportIndicator('irrigation_measurements',list(summary.measurementIds).length,'measurements'),passportIndicator('drainage_measurements',list(summary.drainageMeasurementIds).length,'measurements'),passportIndicator('drainage_volume_liters',finite(summary.drainageVolumeLiters),'L'),passportIndicator('fertigation_applications',list(summary.applicationIds).length,'applications'),passportIndicator('fertigation_volume_liters',finite(summary.fertigationAppliedVolumeLiters),'L'),passportIndicator('fertigation_inventory_lots',list(summary.inventoryLotIds).length,'lots')
 ])
}

export function projectIrrigationMirfeTimeline(projection){
 const events=[]
 for(const item of projection?.pulses||[])events.push({id:`irrigation:pulse:${text(item.id)}`,sourceId:text(item.id),occurredAt:safeDate(item.startedAt),type:'Riego',title:'Pulso de riego',summary:`${finite(item.actualVolumeLiters??item.plannedVolumeLiters)} L · ${text(item.source)||'—'}`,status:text(item.status)})
 for(const item of projection?.applications||[])events.push({id:`mirfe:application:${text(item.id)}`,sourceId:text(item.id),occurredAt:safeDate(item.appliedAt||item.createdAt||item.date),type:'MIRFE',title:'Aplicación de fertirriego',summary:`${finite(item.volumeLiters??item.volumeL)} L · Fórmula ${text(item.formulationId||item.formulaId)||'—'}`,status:text(item.status)})
 for(const item of projection?.measurements||[])events.push({id:`irrigation:measurement:${text(item.id)}`,sourceId:text(item.id),occurredAt:safeDate(item.measuredAt),type:'Riego',title:'Medición de riego',summary:Object.entries(item.values||{}).map(([key,value])=>`${key} ${value}${item.units?.[key]?` ${item.units[key]}`:''}`).join(' · '),status:'Registrada'})
 for(const item of projection?.drainageMeasurements||[])events.push({id:`irrigation:drainage:${text(item.id)}`,sourceId:text(item.id),occurredAt:safeDate(item.measuredAt),type:'Riego',title:'Medición de drenaje',summary:`${finite(item.drainedVolumeLiters)} L · ${finite(item.drainagePercent)}%`,status:'Registrada'})
 return Object.freeze(events)
}
