import{areaSquareMeters,bankCapacity}from'./spaceMetrics.js'

export const FACILITY_TYPES=Object.freeze({SITE:'SITE',AREA:'AREA',HOUSE:'HOUSE',ZONE:'ZONE',BED:'BED',BANK:'BANK',TRAY:'TRAY',POSITION:'POSITION',CONTAINER:'CONTAINER'})
export const CONTAINER_TYPES=Object.freeze({POT:'POT',TRAY_CELL:'TRAY_CELL',BED_POSITION:'BED_POSITION',CUSTOM:'CUSTOM'})

const stable=(type,id)=>`${type}:${id}`
const dimensions=item=>({dimensionUnit:item?.dimensionUnit||'m',length:Number(item?.length||0),width:Number(item?.width||0),height:Number(item?.height||0),areaSquareMeters:areaSquareMeters(item?.length,item?.width,item?.dimensionUnit)})

export function defaultContainerProfile({type=CONTAINER_TYPES.POT,volumeLiters=10,plantsPerContainer=1,growingMediumId='',name='Matera 10 L'}={}){
 return Object.freeze({id:`container-${type.toLowerCase()}-${volumeLiters}`,name,type,volumeLiters:Number(volumeLiters||0),plantsPerContainer:Number(plantsPerContainer||1),growingMediumId,active:true})
}

export function facilityGraphFromState(state){
 const nodes=[]
 for(const site of state.sites||[])nodes.push({id:stable(FACILITY_TYPES.SITE,site.id),entityId:site.id,type:FACILITY_TYPES.SITE,parentId:'',name:site.name,siteId:site.id,dimensions:dimensions(site),capacity:0})
 for(const area of state.facilityAreas||[])nodes.push({id:stable(FACILITY_TYPES.AREA,area.id),entityId:area.id,type:FACILITY_TYPES.AREA,parentId:stable(FACILITY_TYPES.SITE,area.siteId),name:area.name,siteId:area.siteId,dimensions:dimensions(area),capacity:Number(area.capacity||0)})
 for(const house of state.houses||[])nodes.push({id:stable(FACILITY_TYPES.HOUSE,house.id),entityId:house.id,type:FACILITY_TYPES.HOUSE,parentId:house.areaId?stable(FACILITY_TYPES.AREA,house.areaId):stable(FACILITY_TYPES.SITE,house.siteId),name:house.name,siteId:house.siteId,dimensions:dimensions(house),capacity:0,layout:house.layout||'Visual'})
 for(const zone of state.facilityZones||[])nodes.push({id:stable(FACILITY_TYPES.ZONE,zone.id),entityId:zone.id,type:FACILITY_TYPES.ZONE,parentId:stable(FACILITY_TYPES.HOUSE,zone.houseId),name:zone.name,siteId:zone.siteId,dimensions:dimensions(zone),capacity:Number(zone.capacity||0),purpose:zone.purpose||''})
 for(const bed of state.beds||[]){const capacity=Math.max(0,Number(bed.rows||0)*Number(bed.plantsPerRow||0));nodes.push({id:stable(FACILITY_TYPES.BED,bed.id),entityId:bed.id,type:FACILITY_TYPES.BED,parentId:bed.zoneId?stable(FACILITY_TYPES.ZONE,bed.zoneId):stable(FACILITY_TYPES.HOUSE,bed.houseId),name:bed.name,houseId:bed.houseId,siteId:(state.houses||[]).find(item=>item.id===bed.houseId)?.siteId||'',dimensions:dimensions(bed),capacity,activePlants:Number(bed.activePlants||0),containerProfileId:bed.containerProfileId||'container-pot-10'})}
 for(const bank of state.propagationBanks||[]){nodes.push({id:stable(FACILITY_TYPES.BANK,bank.id),entityId:bank.id,type:FACILITY_TYPES.BANK,parentId:bank.zoneId?stable(FACILITY_TYPES.ZONE,bank.zoneId):stable(FACILITY_TYPES.SITE,bank.siteId),name:bank.name,siteId:bank.siteId,dimensions:dimensions(bank),capacity:bankCapacity(bank.trays),active:bank.active!==false});for(const tray of bank.trays||[])nodes.push({id:stable(FACILITY_TYPES.TRAY,`${bank.id}:${tray.id}`),entityId:tray.id,type:FACILITY_TYPES.TRAY,parentId:stable(FACILITY_TYPES.BANK,bank.id),name:tray.label||'Bandeja',siteId:bank.siteId,capacity:Number(tray.quantity||0)*Number(tray.cellsPerTray||0),quantity:Number(tray.quantity||0),cellsPerTray:Number(tray.cellsPerTray||0),growingMediumId:tray.growingMediumId||'',usesPlug:Boolean(tray.usesPlug),plugType:tray.plugType||''})}
 return nodes
}

export function facilityChildren(graph,parentId){return(graph||[]).filter(node=>node.parentId===parentId)}
export function facilityNode(graph,type,entityId){return(graph||[]).find(node=>node.id===stable(type,entityId))||null}
export function facilityCapacitySummary(state){const graph=facilityGraphFromState(state);return{sites:graph.filter(x=>x.type===FACILITY_TYPES.SITE).length,houses:graph.filter(x=>x.type===FACILITY_TYPES.HOUSE).length,beds:graph.filter(x=>x.type===FACILITY_TYPES.BED).length,banks:graph.filter(x=>x.type===FACILITY_TYPES.BANK).length,productionCapacity:graph.filter(x=>x.type===FACILITY_TYPES.BED).reduce((sum,x)=>sum+x.capacity,0),propagationCapacity:graph.filter(x=>x.type===FACILITY_TYPES.BANK).reduce((sum,x)=>sum+x.capacity,0)}}

export function createProductionPositions({bedId,rows,plantsPerRow,containerProfileId='container-pot-10',volumeLiters=10}){const result=[];for(let row=1;row<=Number(rows||0);row++)for(let position=1;position<=Number(plantsPerRow||0);position++)result.push({id:`${bedId}-F${row}-P${position}`,bedId,row,position,containerProfileId,containerType:CONTAINER_TYPES.POT,volumeLiters:Number(volumeLiters||10),plantPositionId:'',active:true});return result}
