import{transactInventory}from'./inventory.js'

export const findingStatuses=['Detectado','En evaluación','Tratamiento aprobado','En tratamiento','Seguimiento','Resuelto','Planta eliminada','Falso positivo']
export const severityLabels={1:'Leve',2:'Moderada',3:'Grave',4:'Crítica'}

export function plantCode(state,plant){
 const bed=state.beds.find(x=>x.id===plant?.bedId)
 const house=state.houses.find(x=>x.id===bed?.houseId)
 const site=state.sites.find(x=>x.id===house?.siteId)
 return `${(site?.name||'SED').slice(0,3).toUpperCase()}-${house?.name||'N'}-${bed?.name||'C'}-F${plant?.row||0}-P${plant?.position||0}`.replaceAll(' ','')
}
export function findingLocation(state,finding){
 const plant=state.plantPositions.find(x=>x.id===finding?.plantPositionId)
 const bed=state.beds.find(x=>x.id===plant?.bedId)
 const house=state.houses.find(x=>x.id===bed?.houseId)
 const site=state.sites.find(x=>x.id===house?.siteId)
 const company=state.companies.find(x=>x.id===site?.companyId)
 return{plant,bed,house,site,company}
}
export function formatDateTime(value){
 if(!value)return'—';const d=new Date(value)
 return Number.isNaN(d.getTime())?String(value):d.toLocaleString('es-CO',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
}
export function isFollowUpDue(f){
 if(!f?.followUpDate||['Resuelto','Falso positivo'].includes(f.status))return false
 const t=new Date();t.setHours(0,0,0,0);return new Date(f.followUpDate+'T00:00:00')<=t
}

function positive(value,label){
 const number=Number(value)
 if(!Number.isFinite(number)||number<=0)throw new Error(`${label} debe ser mayor que cero.`)
 return number
}

export function calculateTreatmentQuantity(dose,doseUnit,mixVolume){
 const d=positive(dose,'La dosis')
 const volume=positive(mixVolume,'El volumen de mezcla')
 if(['mL/L','g/L'].includes(doseUnit))return d*volume
 if(['mL/100 L','g/100 L'].includes(doseUnit))return d*volume/100
 throw new Error(`Unidad de dosis no soportada: ${doseUnit}`)
}

export function treatmentInventoryUnit(doseUnit){
 if(String(doseUnit).startsWith('mL'))return'mL'
 if(String(doseUnit).startsWith('g'))return'g'
 throw new Error(`Unidad de dosis no soportada: ${doseUnit}`)
}

function addHours(value,hours){
 const date=new Date(value)
 if(Number.isNaN(date.getTime()))throw new Error('La fecha de ejecución no es válida.')
 date.setHours(date.getHours()+Number(hours||0))
 return date.toISOString()
}

function addDays(value,days){
 const date=new Date(value)
 if(Number.isNaN(date.getTime()))throw new Error('La fecha de ejecución no es válida.')
 date.setDate(date.getDate()+Number(days||0))
 return date.toISOString()
}

export function activePlantRestrictions(state,plantId,at=new Date().toISOString()){
 const now=new Date(at).getTime()
 const findingIds=new Set((state.findings||[]).filter(x=>x.plantPositionId===plantId).map(x=>x.id))
 const treatments=(state.treatments||[]).filter(x=>x.status==='Ejecutado'&&findingIds.has(x.findingId))
 const reentry=treatments.filter(x=>new Date(x.reentryUntil||0).getTime()>now)
 const harvest=treatments.filter(x=>new Date(x.harvestRestrictedUntil||0).getTime()>now)
 return{
  reentryBlocked:reentry.length>0,
  harvestBlocked:harvest.length>0,
  reentryUntil:reentry.map(x=>x.reentryUntil).sort().at(-1)||'',
  harvestRestrictedUntil:harvest.map(x=>x.harvestRestrictedUntil).sort().at(-1)||'',
  treatmentIds:[...new Set([...reentry,...harvest].map(x=>x.id))]
 }
}

export function scheduleTreatment(state,input){
 const finding=(state.findings||[]).find(x=>x.id===input.findingId)
 if(!finding)throw new Error('Selecciona un hallazgo válido.')
 if(['Resuelto','Falso positivo'].includes(finding.status))throw new Error('No puedes programar un tratamiento para un hallazgo cerrado.')
 const product=(state.products||[]).find(x=>x.id===input.productId)
 if(!product)throw new Error('Selecciona un producto válido.')
 const totalQuantity=calculateTreatmentQuantity(input.dose,input.doseUnit,input.mixVolume)
 const expectedUnit=treatmentInventoryUnit(input.doseUnit)
 if(product.unit!==expectedUnit)throw new Error(`La unidad de inventario del producto debe ser ${expectedUnit}.`)
 const dose=Number(input.dose)
 if(Number(product.doseMin||0)>0&&dose<Number(product.doseMin))throw new Error('La dosis está por debajo de la dosis mínima registrada.')
 if(Number(product.doseMax||0)>0&&dose>Number(product.doseMax))throw new Error('La dosis supera la dosis máxima registrada.')

 const createdAt=input.createdAt||new Date().toISOString()
 const treatment={id:input.id||crypto.randomUUID(),findingId:finding.id,productId:product.id,dose,doseUnit:input.doseUnit,mixVolume:Number(input.mixVolume),totalQuantity,inventoryUnit:expectedUnit,date:input.date||createdAt.slice(0,10),responsible:input.responsible||'',notes:input.notes||'',status:'Programado',createdAt}
 return{...state,treatments:[...(state.treatments||[]),treatment],findings:(state.findings||[]).map(x=>x.id===finding.id?{...x,status:'Tratamiento aprobado',updatedAt:createdAt}:x)}
}

export function executeTreatment(state,input){
 const treatment=(state.treatments||[]).find(x=>x.id===input.treatmentId)
 if(!treatment)throw new Error('Selecciona un tratamiento válido.')
 if(treatment.status==='Ejecutado')throw new Error('Este tratamiento ya fue ejecutado.')
 if(treatment.status!=='Programado')throw new Error('Solo se pueden ejecutar tratamientos programados.')
 const product=(state.products||[]).find(x=>x.id===treatment.productId)
 if(!product)throw new Error('El producto del tratamiento ya no existe.')
 const lot=(state.inventoryLots||[]).find(x=>x.id===input.lotId)
 if(!lot||lot.productId!==product.id)throw new Error('Selecciona un lote físico del producto indicado.')
 const finding=(state.findings||[]).find(x=>x.id===treatment.findingId)
 if(!finding)throw new Error('El hallazgo asociado ya no existe.')
 const executedAt=input.executedAt||new Date().toISOString()
 const quantity=Number(treatment.totalQuantity)
 let next=transactInventory(state,{lotId:lot.id,type:'Consumo',quantity,date:executedAt.slice(0,10),createdAt:executedAt,sourceType:'MipeTreatment',sourceId:treatment.id,reference:`Tratamiento ${treatment.id}`,responsible:input.responsible||treatment.responsible,notes:input.notes||treatment.notes})
 const cost=quantity*Number(product.cost||0)
 const reentryUntil=addHours(executedAt,product.reentryHours||0)
 const harvestRestrictedUntil=addDays(executedAt,product.withdrawalDays||0)
 next={...next,treatments:(next.treatments||[]).map(x=>x.id===treatment.id?{...x,status:'Ejecutado',lotId:lot.id,executedAt,executedBy:input.responsible||treatment.responsible,cost,reentryUntil,harvestRestrictedUntil,executionNotes:input.notes||''}:x),findings:(next.findings||[]).map(x=>x.id===finding.id?{...x,status:'Seguimiento',lastTreatmentAt:executedAt,reentryUntil,harvestRestrictedUntil,updatedAt:executedAt}:x),costEntries:[...(next.costEntries||[]),{id:input.costEntryId||crypto.randomUUID(),date:executedAt.slice(0,10),createdAt:executedAt,module:'MIPE',category:'Tratamiento',amount:cost,quantity,unit:product.unit,productId:product.id,inventoryLotId:lot.id,findingId:finding.id,treatmentId:treatment.id,siteId:lot.siteId,responsible:input.responsible||treatment.responsible,notes:input.notes||''}]}
 return next
}

export function plantTimeline(state,plantId){
 const findings=state.findings.filter(x=>x.plantPositionId===plantId).map(x=>({id:x.id,date:x.createdAt,type:'MIPE',title:state.incidents.find(i=>i.id===x.incidentId)?.name||'Hallazgo',detail:`${x.status} · severidad ${x.severity}`,status:x.status}))
 const treatments=state.treatments.filter(t=>findings.some(f=>f.id===t.findingId)).map(t=>({id:t.id,date:t.executedAt||t.date||t.createdAt,type:'Tratamiento',title:state.products.find(p=>p.id===t.productId)?.name||'Tratamiento',detail:`${t.dose||''} ${t.doseUnit||''} · ${t.totalQuantity||0} ${t.inventoryUnit||''}`,status:t.status}))
 const events=state.plantEvents.filter(x=>x.plantId===plantId)
 return[...findings,...treatments,...events].sort((a,b)=>String(b.date).localeCompare(String(a.date)))
}
