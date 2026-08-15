const text=value=>String(value??'').trim()
const positive=(value,label)=>{const number=Number(value);if(!Number.isFinite(number)||number<=0)throw new Error(`${label} debe ser mayor que cero.`);return number}
const nonNegative=(value,label)=>{const number=Number(value);if(!Number.isFinite(number)||number<0)throw new Error(`${label} no puede ser negativo.`);return number}
const required=(value,label)=>{const normalized=text(value);if(!normalized)throw new Error(`${label} es obligatorio.`);return normalized}
const civilDate=(value,label)=>{const normalized=required(value,label);if(!/^\d{4}-\d{2}-\d{2}$/.test(normalized)||Number.isNaN(Date.parse(`${normalized}T00:00:00Z`)))throw new Error(`${label} debe ser una fecha YYYY-MM-DD válida.`);return normalized}

export const GROWING_MEDIUM_KINDS=Object.freeze({COCO:'COCO',PEAT:'PEAT',SOIL:'SOIL',MIX:'MIX',JIFFY:'JIFFY',PLUG:'PLUG',CUSTOM:'CUSTOM'})
export const REUSE_ACTIONS=Object.freeze({REPLENISH:'REPLENISH',FULL_REPLACEMENT:'FULL_REPLACEMENT'})
export const PURCHASE_SCOPES=Object.freeze({SITE:'SITE',HOUSE:'HOUSE',BED:'BED',TRAY:'TRAY'})

export function createGrowingMediumProduct(input={}){
 const organizationId=required(input.organizationId,'organizationId'),name=required(input.name,'name'),kind=required(input.kind,'kind')
 if(!Object.values(GROWING_MEDIUM_KINDS).includes(kind))throw new Error('kind de medio de cultivo inválido.')
 return Object.freeze({id:required(input.id,'id'),organizationId,name,kind,brand:text(input.brand),supplierId:text(input.supplierId),inventoryItemId:text(input.inventoryItemId),active:input.active!==false,notes:text(input.notes)})
}

export function createGrowingMediumFormula(input={}){
 const organizationId=required(input.organizationId,'organizationId'),components=Array.isArray(input.components)?input.components:[]
 if(!components.length)throw new Error('La fórmula necesita componentes.')
 const normalized=components.map(item=>({productId:required(item.productId,'productId'),percentage:positive(item.percentage,'percentage')}))
 const total=normalized.reduce((sum,item)=>sum+item.percentage,0)
 if(Math.abs(total-100)>0.0001)throw new Error('La composición de la fórmula debe sumar 100%.')
 if(new Set(normalized.map(item=>item.productId)).size!==normalized.length)throw new Error('La fórmula no puede repetir el mismo producto.')
 const id=required(input.id,'id'),formulaKey=text(input.formulaKey)||id,version=Math.max(1,Math.trunc(Number(input.version)||1))
 return Object.freeze({id,organizationId,formulaKey,name:required(input.name,'name'),version,supersedesFormulaId:text(input.supersedesFormulaId),components:Object.freeze(normalized),active:input.active!==false,createdAt:input.createdAt||new Date().toISOString()})
}

export function nextGrowingMediumFormulaVersion(previous,input={}){
 if(!previous?.id||!previous?.organizationId)throw new Error('La fórmula anterior es obligatoria.')
 return createGrowingMediumFormula({...input,id:required(input.id,'id'),organizationId:previous.organizationId,formulaKey:previous.formulaKey||previous.id,name:input.name||previous.name,version:Number(previous.version||1)+1,supersedesFormulaId:previous.id})
}

export function createGrowingMediumBatch(input={}){
 const organizationId=required(input.organizationId,'organizationId'),productId=text(input.productId),formulaId=text(input.formulaId)
 if(Boolean(productId)===Boolean(formulaId))throw new Error('El batch debe referenciar exactamente un producto o una fórmula.')
 const receivedVolumeLiters=positive(input.receivedVolumeLiters,'receivedVolumeLiters'),availableVolumeLiters=nonNegative(input.availableVolumeLiters??receivedVolumeLiters,'availableVolumeLiters')
 if(availableVolumeLiters>receivedVolumeLiters)throw new Error('availableVolumeLiters no puede superar el volumen recibido.')
 return Object.freeze({id:required(input.id,'id'),organizationId,productId,formulaId,supplierId:text(input.supplierId),supplierLot:required(input.supplierLot,'supplierLot'),inventoryLotId:text(input.inventoryLotId),receivedVolumeLiters,availableVolumeLiters,unitCostPerLiter:nonNegative(input.unitCostPerLiter??0,'unitCostPerLiter'),currency:text(input.currency)||'COP',receivedAt:input.receivedAt||new Date().toISOString(),active:input.active!==false})
}

export function createReusePolicy(input={}){
 const replacementPercent=nonNegative(input.replacementPercent??30,'replacementPercent')
 if(replacementPercent>100)throw new Error('replacementPercent no puede superar 100%.')
 const maxUses=Math.max(1,Math.trunc(positive(input.maxUses??3,'maxUses')))
 return Object.freeze({id:required(input.id,'id'),organizationId:required(input.organizationId,'organizationId'),name:required(input.name,'name'),replacementPercent,maxUses,active:input.active!==false})
}

export function createGrowingMediumAssignment(input={}){
 const volumeLiters=positive(input.volumeLiters,'volumeLiters'),unitCostPerLiter=nonNegative(input.unitCostPerLiter??0,'unitCostPerLiter')
 return Object.freeze({id:required(input.id,'id'),organizationId:required(input.organizationId,'organizationId'),siteId:required(input.siteId,'siteId'),targetType:required(input.targetType,'targetType'),targetId:required(input.targetId,'targetId'),batchId:required(input.batchId,'batchId'),volumeLiters,reusePolicyId:text(input.reusePolicyId),currentUse:Math.max(1,Math.trunc(Number(input.currentUse)||1)),supplierId:text(input.supplierId),supplierLot:text(input.supplierLot),inventoryLotId:text(input.inventoryLotId),unitCostPerLiter,currency:text(input.currency)||'COP',totalCost:nonNegative(input.totalCost??volumeLiters*unitCostPerLiter,'totalCost'),assignedAt:input.assignedAt||new Date().toISOString(),active:input.active!==false})
}

export function assignmentFromBatch(input={},batch={}){
 if(input.organizationId!==batch.organizationId)throw new Error('Assignment y batch deben pertenecer a la misma organización.')
 return createGrowingMediumAssignment({...input,supplierId:batch.supplierId,supplierLot:batch.supplierLot,inventoryLotId:batch.inventoryLotId,unitCostPerLiter:batch.unitCostPerLiter,currency:batch.currency,totalCost:Number(input.volumeLiters)*Number(batch.unitCostPerLiter||0)})
}

export function planReuseCycle({assignment,policy,completedUses}={}){
 if(!assignment||!policy)throw new Error('assignment y policy son obligatorios.')
 if(assignment.organizationId!==policy.organizationId)throw new Error('Assignment y ReusePolicy deben pertenecer a la misma organización.')
 const uses=Math.max(0,Math.trunc(Number(completedUses??assignment.currentUse)||0)),volume=positive(assignment.volumeLiters,'volumeLiters')
 if(uses>=policy.maxUses)return Object.freeze({action:REUSE_ACTIONS.FULL_REPLACEMENT,nextUse:1,reusedVolumeLiters:0,freshVolumeLiters:volume,replacementPercent:100})
 const fresh=volume*(policy.replacementPercent/100)
 return Object.freeze({action:REUSE_ACTIONS.REPLENISH,nextUse:uses+1,reusedVolumeLiters:volume-fresh,freshVolumeLiters:fresh,replacementPercent:policy.replacementPercent})
}

export function calculatePurchaseRequirement({organizationId,siteId,plans=[],reservePercent=0}={}){
 required(organizationId,'organizationId');required(siteId,'siteId')
 const reserve=nonNegative(reservePercent,'reservePercent');if(reserve>100)throw new Error('reservePercent no puede superar 100%.')
 const freshVolumeLiters=plans.reduce((sum,plan)=>sum+nonNegative(plan?.freshVolumeLiters??0,'freshVolumeLiters'),0)
 return Object.freeze({organizationId,siteId,baseVolumeLiters:freshVolumeLiters,reservePercent:reserve,requiredVolumeLiters:freshVolumeLiters*(1+reserve/100)})
}

export function createPurchaseRequirement(input={}){
 const organizationId=required(input.organizationId,'organizationId'),siteId=required(input.siteId,'siteId'),scopeType=required(input.scopeType,'scopeType')
 if(!Object.values(PURCHASE_SCOPES).includes(scopeType))throw new Error('scopeType de requerimiento de compra inválido.')
 const scopeId=required(input.scopeId||siteId,'scopeId'),periodStart=civilDate(input.periodStart,'periodStart'),periodEnd=civilDate(input.periodEnd,'periodEnd')
 if(periodEnd<periodStart)throw new Error('periodEnd no puede ser anterior a periodStart.')
 const plans=Array.isArray(input.plans)?input.plans:[]
 if(!plans.length)throw new Error('El requerimiento necesita al menos un plan de consumo.')
 const normalizedPlans=plans.map(plan=>Object.freeze({assignmentId:required(plan.assignmentId,'assignmentId'),targetType:required(plan.targetType,'targetType'),targetId:required(plan.targetId,'targetId'),batchId:required(plan.batchId,'batchId'),supplierId:text(plan.supplierId),supplierLot:text(plan.supplierLot),action:required(plan.action,'action'),currentUse:Math.max(1,Math.trunc(Number(plan.currentUse)||1)),freshVolumeLiters:nonNegative(plan.freshVolumeLiters,'freshVolumeLiters'),reusedVolumeLiters:nonNegative(plan.reusedVolumeLiters??0,'reusedVolumeLiters')}))
 const totals=calculatePurchaseRequirement({organizationId,siteId,plans:normalizedPlans,reservePercent:input.reservePercent})
 return Object.freeze({id:required(input.id,'id'),organizationId,siteId,scopeType,scopeId,periodStart,periodEnd,plans:Object.freeze(normalizedPlans),baseVolumeLiters:totals.baseVolumeLiters,reservePercent:totals.reservePercent,requiredVolumeLiters:totals.requiredVolumeLiters,status:text(input.status)||'OPEN',createdAt:input.createdAt||new Date().toISOString(),createdBy:text(input.createdBy)})
}
