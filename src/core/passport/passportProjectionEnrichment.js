import{projectPlantIrrigationMirfe,projectIrrigationMirfeRelationships,projectIrrigationMirfeIndicators,projectIrrigationMirfeTimeline}from'./irrigationMirfePassportProjection.js'

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
function enrichCultivationPlant(input,source){
 const object=input?.object,state=input?.state
 if(object?.objectType!=='cultivation.plant'||!state)return source
 const organizationId=text(object.organizationId),plant={id:text(object.objectId),trayId:text(object?.identity?.trayId)},location=cultivationLocation(source,object)
 const irrigationMirfe=projectPlantIrrigationMirfe(state,{plant,location,organizationId})
 if(!hasIrrigationMirfeEvidence(irrigationMirfe))return source
 return{...source,relationships:[...list(source?.relationships),...projectIrrigationMirfeRelationships(irrigationMirfe,organizationId)],indicators:[...list(source?.indicators),...projectIrrigationMirfeIndicators(irrigationMirfe)],timeline:[...list(source?.timeline),...projectIrrigationMirfeTimeline(irrigationMirfe)]}
}
const ENRICHERS=Object.freeze({'cultivation.plant.projection':enrichCultivationPlant})
export function enrichPassportProjection(pluginId,input,source){const enrich=ENRICHERS[text(pluginId)];return enrich?enrich(input,source):source}
