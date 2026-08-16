import{transactInventory}from'./inventory.js'
import{mutateIrrigationMirfeState}from'./irrigationMirfeTenancy.js'

const positive=(value,label)=>{const number=Number(value);if(!Number.isFinite(number)||number<=0)throw new Error(`${label} debe ser mayor que cero.`);return number}

export function gramsToInventoryUnit(grams,unit){
 const value=positive(grams,'La cantidad formulada')
 if(unit==='g')return value
 if(unit==='kg')return value/1000
 throw new Error('El producto de inventario debe usar g o kg para descontar una formulación en gramos.')
}

function createTankPreparationForTenant(state,input){
 const formulation=(state.formulations||[]).find(x=>x.id===input.formulationId)
 if(!formulation)throw new Error('Selecciona una formulación válida.')
 if(formulation.status!=='Aprobada')throw new Error('Solo se pueden preparar fórmulas aprobadas.')
 if((state.tankPreparations||[]).some(x=>x.formulationId===formulation.id&&!['Cancelada','Aplicada'].includes(x.status)))throw new Error('Ya existe una preparación activa para esta formulación.')
 const items=(formulation.items||[]).map((item,index)=>({id:item.id||`${formulation.id}-${index}`,nutrientProductId:item.productId,tank:item.tank||'A',requiredQuantity:positive(item.grams,'La cantidad formulada'),requiredUnit:'g',inventoryProductId:(state.nutrientProducts||[]).find(x=>x.id===item.productId)?.inventoryProductId||'',lotId:'',consumedQuantity:0,consumedUnit:'',cost:0}))
 if(!items.length)throw new Error('La formulación no contiene productos.')
 const createdAt=input.createdAt||new Date().toISOString()
 const preparation={id:input.id||crypto.randomUUID(),formulationId:formulation.id,siteId:formulation.siteId,volumeL:Number(formulation.volumeL||0),stage:formulation.stage||'',date:input.date||createdAt.slice(0,10),status:'Pendiente',items,createdAt,responsible:input.responsible||'',notes:input.notes||'',totalCost:0}
 return{...state,tankPreparations:[...(state.tankPreparations||[]),preparation]}
}

export function createTankPreparation(state,input){
 return mutateIrrigationMirfeState(state,tenant=>createTankPreparationForTenant(tenant,input))
}

function executeTankPreparationForTenant(state,input){
 const preparation=(state.tankPreparations||[]).find(x=>x.id===input.preparationId)
 if(!preparation)throw new Error('Selecciona una preparación válida.')
 if(preparation.status!=='Pendiente')throw new Error('Solo se pueden ejecutar preparaciones pendientes.')
 const allocations=input.allocations||{};const executedAt=input.executedAt||new Date().toISOString();let next=state,totalCost=0;const executedItems=[]
 for(const item of preparation.items||[]){
  if(!item.inventoryProductId)throw new Error('Todos los productos nutricionales deben estar vinculados con un producto de inventario.')
  const lotId=allocations[item.id]||item.lotId;const lot=(next.inventoryLots||[]).find(x=>x.id===lotId)
  if(!lot||lot.productId!==item.inventoryProductId)throw new Error('Selecciona un lote válido para cada ingrediente.')
  if(lot.siteId!==preparation.siteId)throw new Error('El lote seleccionado debe pertenecer a la sede de la preparación.')
  const inventoryProduct=(next.products||[]).find(x=>x.id===lot.productId);const nutrientProduct=(next.nutrientProducts||[]).find(x=>x.id===item.nutrientProductId)
  const quantity=gramsToInventoryUnit(item.requiredQuantity,inventoryProduct?.unit)
  next=transactInventory(next,{lotId,type:'Consumo',quantity,date:input.date||executedAt.slice(0,10),createdAt:executedAt,sourceType:'MirfePreparation',sourceId:preparation.id,responsible:input.responsible||preparation.responsible,reference:preparation.id,notes:`Preparación MIRFE · Tanque ${item.tank}`})
  const unitCost=Number(inventoryProduct?.cost??nutrientProduct?.cost??0);const cost=quantity*unitCost;totalCost+=cost
  executedItems.push({...item,lotId,consumedQuantity:quantity,consumedUnit:inventoryProduct?.unit||'',cost,executedAt})
 }
 const costEntry=totalCost>0?{id:input.costEntryId||crypto.randomUUID(),date:input.date||executedAt.slice(0,10),createdAt:executedAt,category:'MIRFE',concept:'Preparación de fertirriego',amount:totalCost,quantity:1,unit:'preparación',sourceType:'MirfePreparation',sourceId:preparation.id,siteId:preparation.siteId,responsible:input.responsible||preparation.responsible||'',notes:`${preparation.volumeL} L · ${preparation.stage}`}:null
 const workOrder={id:input.workOrderId||crypto.randomUUID(),createdAt:executedAt,title:`Aplicar preparación ${preparation.volumeL} L`,siteId:preparation.siteId,responsible:input.responsible||preparation.responsible||'',dueDate:input.date||executedAt.slice(0,10),status:'Pendiente',instructions:`Aplicar preparación MIRFE ${preparation.id.slice(0,8)} · ${preparation.stage}`,sourceType:'MirfePreparation',sourceId:preparation.id,preparationId:preparation.id}
 return{...next,tankPreparations:(next.tankPreparations||[]).map(x=>x.id===preparation.id?{...x,status:'Preparada',items:executedItems,totalCost,preparedAt:executedAt,preparedBy:input.responsible||x.responsible}:x),costEntries:costEntry?[...(next.costEntries||[]),costEntry]:(next.costEntries||[]),workOrders:[...(next.workOrders||[]),workOrder]}
}

export function executeTankPreparation(state,input){
 return mutateIrrigationMirfeState(state,tenant=>executeTankPreparationForTenant(tenant,input))
}

function registerIrrigationApplicationForTenant(state,input){
 const preparation=(state.tankPreparations||[]).find(x=>x.id===input.preparationId)
 if(!preparation)throw new Error('Selecciona una preparación válida.')
 if(preparation.status!=='Preparada')throw new Error('La preparación debe estar ejecutada antes de aplicarse.')
 if((state.irrigationApplications||[]).some(x=>x.preparationId===preparation.id))throw new Error('Esta preparación ya fue aplicada.')
 const volumeL=positive(input.volumeL||preparation.volumeL,'El volumen aplicado')
 if(volumeL>Number(preparation.volumeL||0))throw new Error('El volumen aplicado no puede superar el volumen preparado.')
 const createdAt=input.createdAt||new Date().toISOString()
 const application={id:input.id||crypto.randomUUID(),preparationId:preparation.id,formulationId:preparation.formulationId,siteId:preparation.siteId,houseId:input.houseId||'',date:input.date||createdAt.slice(0,10),volumeL,ec:Number(input.ec||0),ph:Number(input.ph||0),responsible:input.responsible||'',notes:input.notes||'',status:'Aplicada',createdAt}
 return{...state,irrigationApplications:[...(state.irrigationApplications||[]),application],tankPreparations:(state.tankPreparations||[]).map(x=>x.id===preparation.id?{...x,status:'Aplicada',appliedAt:createdAt,applicationId:application.id}:x),workOrders:(state.workOrders||[]).map(x=>x.preparationId===preparation.id&&x.status!=='Completada'?{...x,status:'Completada',completedAt:createdAt}:x)}
}

export function registerIrrigationApplication(state,input){
 return mutateIrrigationMirfeState(state,tenant=>registerIrrigationApplicationForTenant(tenant,input))
}
