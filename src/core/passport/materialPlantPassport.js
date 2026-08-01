import{createIntelligentObject,createPassport}from'./passportContract.js'
import{materialPlantUnitById,MATERIAL_PLANT_TYPES}from'../../domain/materialPlantIdentity.js'

const list=value=>Array.isArray(value)?value:[]
const iso=value=>Number.isNaN(Date.parse(value))?null:new Date(value).toISOString()
const typeName=type=>type===MATERIAL_PLANT_TYPES.GRANDMOTHER?'Abuela':'Madre'
const isOpenFinding=item=>!['Resuelto','Falso positivo'].includes(item.status)

function documentsFor(state,unit){
 const legacyType=unit.plantType===MATERIAL_PLANT_TYPES.GRANDMOTHER?'grandmotherLot':'motherLot'
 return list(state.attachments).filter(item=>(item.entityType==='materialPlant'&&item.entityId===unit.id)||(item.entityType===legacyType&&item.entityId===unit.lotId)).map(item=>({id:item.id,name:item.name||'Adjunto',type:item.type||'application/octet-stream',size:Number(item.size)||0,dataUrl:item.dataUrl||'',createdAt:iso(item.createdAt)}))
}

function findingsFor(state,unit){
 return list(state.findings).filter(item=>item.materialPlantId===unit.id||(item.entityType==='materialPlant'&&item.entityId===unit.id)||(item.plantId===unit.id&&item.plantPositionId==null)).map(item=>({id:item.id,type:item.type||item.pest||'Hallazgo MIPE',status:item.status||'Abierto',severity:item.severity||'—',notes:item.notes||item.observation||'',reportedAt:iso(item.reportedAt||item.reportDate||item.createdAt)}))
}

function timelineFor(state,unit,findings){
 const entries=list(state.timelineEntries).filter(item=>item.aggregateId===unit.id||item.objectId===unit.id||item.entityId===unit.id)
 const plantEvents=list(state.plantEvents).filter(item=>item.plantId===unit.id||item.entityId===unit.id).map(item=>({id:item.id,occurredAt:iso(item.date||item.createdAt),title:item.title||item.type||'Evento de planta',summary:item.detail||item.notes||'',category:item.type||'Material vegetal',status:item.status||''}))
 const findingEvents=findings.map(item=>({id:`mipe:${item.id}`,occurredAt:item.reportedAt,title:item.type,summary:item.notes,category:'MIPE',status:item.status,severity:item.severity}))
 return[...entries,...plantEvents,...findingEvents].sort((a,b)=>Date.parse(b.occurredAt||b.createdAt||0)-Date.parse(a.occurredAt||a.createdAt||0))
}

function relationshipsFor(state,unit){
 const lot=unit.sourceLot||{}
 const relationships=[{type:'member_of_lot',targetType:'cultivation.material_lot',targetId:unit.lotId,label:lot.lotCode||lot.code||unit.lotId}]
 const site=list(state.sites).find(item=>item.id===unit.siteId)
 if(site)relationships.push({type:'located_in',targetType:'organization.site',targetId:site.id,label:site.name||site.id})
 if(unit.plantType===MATERIAL_PLANT_TYPES.MOTHER){const grandmotherLot=list(state.grandmotherPlants).find(item=>item.id===lot.grandmotherPlantId);if(grandmotherLot)relationships.push({type:'descends_from',targetType:'cultivation.grandmother_lot',targetId:grandmotherLot.id,label:grandmotherLot.lotCode||grandmotherLot.id})}
 if(unit.parentPlantId)relationships.push({type:'descends_from',targetType:'cultivation.material_plant',targetId:unit.parentPlantId,label:unit.parentPlantId})
 return relationships
}

function descendantsFor(state,unit){
 if(unit.plantType===MATERIAL_PLANT_TYPES.GRANDMOTHER)return list(state.motherPlants).filter(item=>item.grandmotherPlantId===unit.lotId).reduce((sum,item)=>sum+Number(item.quantity||1),0)
 return list(state.propagationBatches).filter(item=>item.motherPlantId===unit.lotId).reduce((sum,item)=>sum+Number(item.activeQuantity??item.quantity??0),0)
}

export function createMaterialPlantPassportFromState(state,{unitId,actions=[],decisionContext={}}={}){
 const unit=materialPlantUnitById(state,unitId)
 if(!unit)throw new Error('No se encontró la planta de material vegetal solicitada')
 const lot=unit.sourceLot||{},site=list(state.sites).find(item=>item.id===unit.siteId)||null
 const companyId=site?.companyId||state.currentContext?.companyId||'local-installation'
 const genetic=list(state.genetics).find(item=>item.id===unit.geneticId)||null
 const createdAt=iso(unit.createdAt)||new Date().toISOString(),updatedAt=iso(unit.updatedAt)||createdAt
 const descendants=descendantsFor(state,unit),documents=documentsFor(state,unit),findings=findingsFor(state,unit),timeline=timelineFor(state,unit,findings)
 const object=createIntelligentObject({objectType:'cultivation.materialplant',objectId:unit.id,organizationId:companyId,siteId:unit.siteId||null,label:unit.code,status:unit.status||'Activa',createdAt,updatedAt,identity:{code:unit.code,plantType:unit.plantType,unitIndex:unit.unitIndex,lotId:unit.lotId},attributes:{typeLabel:typeName(unit.plantType),geneticId:unit.geneticId||null,geneticName:genetic?.name||'',healthStatus:unit.healthStatus||'',notes:unit.notes||'',location:unit.location||null,source:lot.source||'',cycleStartedAt:lot.cycleStartedAt||null},metadata:{compatibilityMode:'material-lot-projection-v1',sourceCollection:unit.plantType===MATERIAL_PLANT_TYPES.GRANDMOTHER?'grandmotherPlants':'motherPlants'}})
 const risks=findings.filter(isOpenFinding).map(item=>({id:`mipe:${item.id}`,type:'mipe.finding',severity:item.severity,status:item.status,label:item.type,notes:item.notes}))
 if(unit.healthStatus&&unit.healthStatus!=='Sana')risks.push({id:`health:${unit.id}`,type:'health.status',severity:unit.healthStatus==='No apta'?'high':'medium',status:unit.healthStatus,label:`Sanidad: ${unit.healthStatus}`})
 if(['Retirada','Descartada','Fallecida'].includes(unit.status))risks.push({id:`status:${unit.id}`,type:'lifecycle.status',severity:'high',status:unit.status,label:`Estado: ${unit.status}`})
 return createPassport({object,relationships:relationshipsFor(state,unit),documents,indicators:[{key:'descendants',value:descendants,unit:'plants'},{key:'documents',value:documents.length,unit:'files'},{key:'timeline_events',value:timeline.length,unit:'events'},{key:'open_mipe_findings',value:findings.filter(isOpenFinding).length,unit:'findings'},{key:'mipe_findings_total',value:findings.length,unit:'findings'}],risks,actions,timeline,decisionContext})
}
