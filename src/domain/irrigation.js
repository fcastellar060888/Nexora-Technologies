export const stages=['Clones/enraizamiento','Vegetativo temprano','Vegetativo fuerte','Madres','Floración inicial','Floración media','Floración final'];
export function hydraulics(rows,apps,minutes,tank){
 const plants=rows.reduce((s,x)=>s+Number(x.activePlants||0),0);
 const flow=rows.reduce((s,x)=>s+Number(x.activePlants||0)*Number(x.drippers||1)*Number(x.flow||2),0);
 const pulse=flow*Number(minutes||0)/60;
 const daily=pulse*Number(apps||0);
 const loads=daily?Math.ceil(daily/Number(tank||1000)):0;
 const last=daily?(daily%Number(tank||1000)||Number(tank||1000)):0;
 return {plants,flow,pulse,daily,loads,last};
}
export function waterForSite(state,siteId){return [...state.waterAnalyses].reverse().find(x=>x.siteId===siteId&&x.status==='Vigente')}
