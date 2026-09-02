import{projectPlantIrrigationMirfe,projectIrrigationMirfeRelationships,projectIrrigationMirfeIndicators,projectIrrigationMirfeTimeline}from'./irrigationMirfePassportProjection.js'
import{projectMipePassportTrace}from'./mipePassportProjection.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
function relatedId(source,targetType){return text(list(source?.relationships).find(item=>item?.targetType===targetType)?.targetId)}
function cultivationLocation(source,object){
 const bedId=text(object?.identity?.bedId)||relatedId(source,'cultivation.bed'),houseId=relatedId(source,'cultivation.house'),siteId=text(object?.siteId)||relatedId(source,'organization.site')
 return{bed:bedId?{id:bedId}:null,house:houseId?{id:houseId}:null,site:siteId?{id:siteId}:null}
}
function hasIrrigationMirfeEvidence(projection){
 const summary=projection?.summary||{}
 return['assignmentIds','pulseIds','measurementIds','drainageMeasurementIds','applicationIds','preparationIds','formulaIds','inventoryLotIds'].some(key=>list(summary[key]).length>0)
}
function addMipeTrace(state,object,source,{targetType,includeTreatmentTimeline=false,replaceLegacyTreatmentTimeline=false}={}){
 const trace=projectMipePassportTrace(state,{organizationId:text(object.organizationId),targetType,targetId:text(object.objectId),includeTreatmentTimeline})
 const canonicalTreatmentIds=new Set(list(trace?.summary?.treatmentIds).map(text))
 const baseTimeline=replaceLegacyTreatmentTimeline?list(source?.timeline).filter(item=>!text(item?.id).startsWith('treatment:')||!canonicalTreatmentIds.has(text(item?.sourceId))):list(source?.timeline)
 return{...source,relationships:[...list(source?.relationships),...trace.relationships],indicators:[...list(source?.indicators),...trace.indicators],timeline:[...baseTimeline,...trace.timeline]}
}
function enrichCultivationPlant(input,source){
 const object=input?.object,state=input?.state
 if(object?.objectType!=='cultivation.plant'||!state)return source
 const organizationId=text(object.organizationId),plant={id:text(object.objectId),trayId:text(object?.identity?.trayId),createdAt:object.createdAt||null},location=cultivationLocation(source,object),irrigationMirfe=projectPlantIrrigationMirfe(state,{plant,location,organizationId})
 const enriched=hasIrrigationMirfeEvidence(irrigationMirfe)?{...source,relationships:[...list(source?.relationships),...projectIrrigationMirfeRelationships(irrigationMirfe,organizationId)],indicators:[...list(source?.indicators),...projectIrrigationMirfeIndicators(irrigationMirfe)],timeline:[...list(source?.timeline),...projectIrrigationMirfeTimeline(irrigationMirfe)]}:source
 return addMipeTrace(state,object,enriched,{targetType:'POSITION',includeTreatmentTimeline:true,replaceLegacyTreatmentTimeline:true})
}
function enrichMaterialPlant(input,source){
 const object=input?.object,state=input?.state
 if(object?.objectType!=='cultivation.materialplant'||!state)return source
 return addMipeTrace(state,object,source,{targetType:'MATERIAL_PLANT',includeTreatmentTimeline:true})
}
const ENRICHERS=Object.freeze({'cultivation.plant.projection':enrichCultivationPlant,'cultivation.materialplant.projection':enrichMaterialPlant})
export function enrichPassportProjection(pluginId,input,source){const enrich=ENRICHERS[text(pluginId)];return enrich?enrich(input,source):source}
