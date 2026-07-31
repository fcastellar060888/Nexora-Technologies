function duplicateIds(items){const seen=new Set(),dup=[];for(const x of items||[]){if(!x?.id)continue;if(seen.has(x.id))dup.push(x.id);seen.add(x.id)}return dup}
export function runDiagnostics(state){
 const checks=[]
 const add=(name,status,detail,level='info')=>checks.push({name,status,detail,level})
 const arrays=['motherPlants','propagationBatches','propagationUnits','phaseTransitions','cultivationCycles','companies','sites','houses','beds','plantPositions','genetics','incidents','findings','products','inventoryLots','mirfeMonitoring','waterAnalyses','nutrientObjectives','formulations','productionFlows']
 for(const key of arrays){const d=duplicateIds(state[key]);add(`IDs únicos: ${key}`,d.length===0,d.length?`${d.length} duplicados`:'Correcto',d.length?'error':'ok')}
 const missingSite=state.houses.filter(x=>!state.sites.some(s=>s.id===x.siteId))
 add('Naves con sede válida',missingSite.length===0,missingSite.length?`${missingSite.length} naves huérfanas`:'Correcto',missingSite.length?'error':'ok')
 const missingHouse=state.beds.filter(x=>!state.houses.some(h=>h.id===x.houseId))
 add('Camas con nave válida',missingHouse.length===0,missingHouse.length?`${missingHouse.length} camas huérfanas`:'Correcto',missingHouse.length?'error':'ok')
 const missingBed=state.plantPositions.filter(x=>!state.beds.some(b=>b.id===x.bedId))
 add('Plantas con cama válida',missingBed.length===0,missingBed.length?`${missingBed.length} posiciones huérfanas`:'Correcto',missingBed.length?'error':'ok')
 const missingMother=state.propagationBatches.filter(x=>!state.motherPlants.some(m=>m.id===x.motherPlantId))
 add('Lotes con madre válida',missingMother.length===0,missingMother.length?`${missingMother.length} lotes sin madre válida`:'Correcto',missingMother.length?'error':'ok')
 const missingBatch=state.propagationUnits.filter(x=>!state.propagationBatches.some(b=>b.id===x.batchId))
 add('Esquejes con lote válido',missingBatch.length===0,missingBatch.length?`${missingBatch.length} esquejes sin lote`:'Correcto',missingBatch.length?'error':'ok')
 const duplicatePlantAssignment=state.propagationUnits.filter((x,i,a)=>x.plantPositionId&&a.findIndex(y=>y.plantPositionId===x.plantPositionId)!==i)
 add('Una planta por esqueje',duplicatePlantAssignment.length===0,duplicatePlantAssignment.length?`${duplicatePlantAssignment.length} asignaciones duplicadas`:'Correcto',duplicatePlantAssignment.length?'error':'ok')
 const missingPlant=state.findings.filter(x=>!state.plantPositions.some(p=>p.id===x.plantPositionId))
 add('Hallazgos con planta válida',missingPlant.length===0,missingPlant.length?`${missingPlant.length} hallazgos huérfanos`:'Correcto',missingPlant.length?'error':'ok')
 const sitesWithoutWater=state.sites.filter(s=>!state.waterAnalyses.some(a=>a.siteId===s.id&&a.status==='Vigente'))
 add('Análisis de agua vigentes',sitesWithoutWater.length===0,sitesWithoutWater.length?`${sitesWithoutWater.length} sedes sin análisis vigente`:'Todas las sedes cubiertas',sitesWithoutWater.length?'warning':'ok')
 const approvedObjectives=state.nutrientObjectives.filter(x=>x.status==='Aprobada').length
 add('Objetivos nutricionales aprobados',approvedObjectives>0,approvedObjectives?`${approvedObjectives} aprobados`:'No hay objetivos aprobados',approvedObjectives?'ok':'warning')
 const formulasPending=state.formulations.filter(x=>x.status!=='Aprobada').length
 add('Fórmulas pendientes de aprobación',formulasPending===0,formulasPending?`${formulasPending} pendientes`:'Todas aprobadas',formulasPending?'warning':'ok')
 const negativeStock=state.inventoryLots.filter(x=>Number(x.quantity)<0)
 add('Inventario sin negativos',negativeStock.length===0,negativeStock.length?`${negativeStock.length} lotes negativos`:'Correcto',negativeStock.length?'error':'ok')
 const size=new Blob([JSON.stringify(state)]).size/1024/1024
 add('Tamaño almacenamiento local',size<4,`${size.toFixed(2)} MB`,size>=4?'warning':'ok')
 return checks
}
