export const propagationStatuses=['Cortado','En propagación','Enraizado','Descartado','Trasplantado a vegetativo']
export const cultivationPhases=['Madre','Propagación','Vegetativo','Floración','Cosecha','Secado','Manicura','Selección','Empaque','Finalizado']

export function motherCode(state,mother){
 const site=state.sites.find(x=>x.id===mother.siteId)
 const genetic=state.genetics.find(x=>x.id===mother.geneticId)
 return `${(site?.name||'SED').slice(0,3).toUpperCase()}-M-${(genetic?.name||'GEN').replaceAll(' ','').slice(0,6).toUpperCase()}-${String(mother.sequence||1).padStart(3,'0')}`
}
export function propagationCode(batch){
 return `PROP-${String(batch.cutDate||'').replaceAll('-','')}-${String(batch.sequence||1).padStart(3,'0')}`
}
export function unitCode(batch,index){
 return `${batch.code}-E${String(index).padStart(3,'0')}`
}
export function descendantsOfMother(state,motherId){
 const batchIds=state.propagationBatches.filter(x=>x.motherPlantId===motherId).map(x=>x.id)
 const units=state.propagationUnits.filter(x=>batchIds.includes(x.batchId))
 const plantIds=units.map(x=>x.plantPositionId).filter(Boolean)
 return{batches:state.propagationBatches.filter(x=>batchIds.includes(x.id)),units,plants:state.plantPositions.filter(x=>plantIds.includes(x.id))}
}
export function tracePlant(state,plantId){
 const plant=state.plantPositions.find(x=>x.id===plantId)
 const unit=state.propagationUnits.find(x=>x.plantPositionId===plantId)
 const batch=state.propagationBatches.find(x=>x.id===unit?.batchId)
 const mother=state.motherPlants.find(x=>x.id===batch?.motherPlantId)
 const transitions=state.phaseTransitions.filter(x=>x.entityType==='plant'&&x.entityId===plantId).sort((a,b)=>String(a.date).localeCompare(String(b.date)))
 return{plant,unit,batch,mother,transitions}
}
