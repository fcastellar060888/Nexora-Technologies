import{MAX_IRRIGATION_TANK_CAPACITY_LITERS,planIrrigationTankLoads}from'./irrigationTankPlanning.js'

export const stages=['Clones/enraizamiento','Vegetativo temprano','Vegetativo fuerte','Madres','Floración inicial','Floración media','Floración final'];
export function hydraulics(rows,apps,minutes,tank=MAX_IRRIGATION_TANK_CAPACITY_LITERS,{planId=''}={}){
 const plants=rows.reduce((s,x)=>s+Number(x.activePlants||0),0);
 const flow=rows.reduce((s,x)=>s+Number(x.activePlants||0)*Number(x.drippers||1)*Number(x.flow||2),0);
 const pulse=flow*Number(minutes||0)/60;
 const tankPlan=planIrrigationTankLoads({planId,pulseVolumeLiters:pulse,applicationsPerDay:apps,tankCapacityLiters:tank});
 return{plants,flow,pulse,daily:tankPlan.dailyVolumeLiters,loads:tankPlan.preparationCount,last:tankPlan.lastLoadVolumeLiters,...tankPlan};
}
export function waterForSite(state,siteId){return [...state.waterAnalyses].reverse().find(x=>x.siteId===siteId&&x.status==='Vigente')}
