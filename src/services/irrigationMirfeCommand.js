import{DomainEvents}from'../core/events/eventCatalog.js'
import{FORMULATION_NUTRIENTS,netTargets,normalizedComposition,normalizedWaterComposition,validateFormula}from'../domain/formulation.js'
import{createFertigationFormula,nextFertigationFormulaVersion}from'../domain/irrigationMirfe.js'
import{irrigationHydraulicsForPlan}from'../domain/irrigationTopology.js'
import{activeOrganizationId,explicitOrganizationId}from'../domain/organizationOwnership.js'
import{createTankPreparation,executeTankPreparation,registerIrrigationApplication}from'../domain/irrigationExecution.js'
import{IRRIGATION_MIRFE_OWNERSHIP_COLLECTIONS,mutateIrrigationMirfeState,scopeIrrigationMirfeState}from'../domain/irrigationMirfeTenancy.js'
import{activeUser,hasPermission}from'./permissions.js'
import{executeCoreOperationCommand}from'./coreOperationCommand.js'
import{applyMirfeInventoryConfirmation,buildMirfeInventoryTransaction}from'./mirfeInventoryTransaction.js'

export const IRRIGATION_MIRFE_OPERATIONS=Object.freeze({
 CREATE_IRRIGATION_PLAN:'CREATE_IRRIGATION_PLAN',
 RECORD_WATER_ANALYSIS:'RECORD_WATER_ANALYSIS',
 CREATE_NUTRIENT_PRODUCT:'CREATE_NUTRIENT_PRODUCT',
 RECORD_NUTRIENT_OBJECTIVE:'RECORD_NUTRIENT_OBJECTIVE',
 CREATE_FORMULATION:'CREATE_FORMULATION',
 APPROVE_FORMULATION:'APPROVE_FORMULATION',
 CREATE_PREPARATION:'CREATE_PREPARATION',
 EXECUTE_PREPARATION:'EXECUTE_PREPARATION',
 REGISTER_APPLICATION:'REGISTER_APPLICATION'
})

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const plainObject=value=>value&&typeof value==='object'&&!Array.isArray(value)

function canonical(value){
 if(Array.isArray(value))return value.map(canonical)
 if(plainObject(value))return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]))
 return value
}

function stable(value){return JSON.stringify(canonical(value))}

export function irrigationMirfeCommandRequestKey({operation,entityId='',input={}}={}){
 return stable({operation:text(operation),entityId:text(entityId),input:plainObject(input)?input:{}})
}

export function irrigationMirfeCommandSignature({operation,aggregateId,input={}}={}){
 return stable({operation:text(operation),aggregateId:text(aggregateId),input:plainObject(input)?input:{}})
}

function required(value,label){const normalized=text(value);if(!normalized)throw new Error(`${label} es obligatorio.`);return normalized}
function finite(value,label,{positive=false}={}){const number=Number(value);if(!Number.isFinite(number)||(positive&&number<=0))throw new Error(`${label} debe ser ${positive?'mayor que cero':'numérico'}.`);return number}
function knownOperation(operation){return Object.values(IRRIGATION_MIRFE_OPERATIONS).includes(operation)}

function permissionFor(operation){
 if(operation===IRRIGATION_MIRFE_OPERATIONS.REGISTER_APPLICATION)return'record_irrigation'
 return'manage_irrigation'
}

function authorize(state,operation,organizationId,siteId){
 const permission=permissionFor(operation)
 if(!hasPermission(state,permission,{companyId:organizationId,siteId}))throw new Error(`No tienes permiso ${permission} para ejecutar esta operación MIRFE.`)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.APPROVE_FORMULATION&&!hasPermission(state,'approve_formulas',{companyId:organizationId,siteId}))throw new Error('No tienes permiso para aprobar fórmulas.')
}

function receipts(record){return list(record?.commandReceipts).filter(item=>plainObject(item)&&text(item.commandId))}

function findReceipt(state,organizationId,commandId){
 const tenant=scopeIrrigationMirfeState(state,organizationId),matches=[]
 for(const collection of IRRIGATION_MIRFE_OWNERSHIP_COLLECTIONS)for(const record of list(tenant?.[collection]))for(const receipt of receipts(record))if(receipt.commandId===commandId)matches.push({collection,record,receipt})
 if(matches.length>1){
  const signatures=new Set(matches.map(item=>item.receipt.signature))
  if(signatures.size>1)throw new Error('El commandId colisiona con recibos MIRFE diferentes.')
 }
 return matches[0]||null
}

function assertReceipt(receipt,signature){
 if(receipt&&receipt.signature!==signature)throw new Error('El commandId ya fue usado con contenido diferente.')
}

function appendReceipt(state,collection,id,receipt){
 return mutateIrrigationMirfeState(state,tenant=>{
  const items=list(tenant?.[collection]),matches=items.filter(item=>item.id===id)
  if(matches.length!==1)throw new Error(`No se pudo asociar el recibo al agregado ${collection}/${id}.`)
  return{...tenant,[collection]:items.map(item=>item.id===id?{...item,commandReceipts:[...receipts(item),receipt]}:item)}
 })
}

function applyOnce(current,organizationId,receipt,collection,id,mutation){
 if(activeOrganizationId(current)!==organizationId)throw new Error('La empresa activa cambió antes de confirmar la operación MIRFE.')
 const existing=findReceipt(current,organizationId,receipt.commandId)
 if(existing){assertReceipt(existing.receipt,receipt.signature);return current}
 return appendReceipt(mutation(current),collection,id,receipt)
}

function appendRecord(current,collection,record){
 return mutateIrrigationMirfeState(current,tenant=>{
  const items=list(tenant?.[collection])
  if(items.some(item=>item.id===record.id))throw new Error(`${collection} ya contiene ese id en la empresa activa.`)
  return{...tenant,[collection]:[...items,record]}
 })
}

function activeTenantState(state,organizationId){return scopeIrrigationMirfeState(state,organizationId)}

function planIrrigation(state,input,aggregateId,organizationId,occurredAt){
 const tenant=activeTenantState(state,organizationId),siteId=required(input.siteId,'siteId'),houseId=text(input.houseId),sectorId=text(input.sectorId),geneticId=text(input.geneticId)
 const rows=list(tenant.beds).filter(bed=>!houseId||bed.houseId===houseId).filter(bed=>!geneticId||bed.geneticId===geneticId).map(bed=>({...bed,drippers:bed.drippers||1,flow:bed.flow||2}))
 const apps=finite(input.apps,'apps',{positive:true}),minutes=finite(input.minutes,'minutes',{positive:true}),tank=finite(input.tank,'tank',{positive:true})
 const result=irrigationHydraulicsForPlan(state,{organizationId,siteId,houseId,sectorId,geneticId,at:occurredAt,apps,minutes,tank,legacyRows:rows})
 const water=[...list(tenant.waterAnalyses)].reverse().find(item=>item.siteId===siteId&&item.status==='Vigente')
 const record={id:aggregateId,organizationId,date:text(input.date)||occurredAt.slice(0,10),siteId,houseId,sectorId,geneticId,stage:text(input.stage),apps,minutes,tank,...result,waterStatus:water?'Vigente':'Pendiente'}
 return{aggregateType:'mirfe.irrigation-plan',aggregateId,eventName:DomainEvents.MIRFE_IRRIGATION_PLAN_CREATED,siteId,eventPayload:{planId:aggregateId,siteId,houseId,sectorId,geneticId,plants:result.plants,dailyLiters:result.daily,loads:result.loads,calculationMode:result.calculationMode,assignmentCount:result.assignmentCount,sectorCount:result.sectorCount,emitterCount:result.emitterCount},collection:'irrigationPlans',apply:current=>appendRecord(current,'irrigationPlans',record)}
}

function planWaterAnalysis(input,aggregateId,organizationId,occurredAt){
 const siteId=required(input.siteId,'siteId'),status=text(input.status)||'Pendiente',record={id:aggregateId,...input,organizationId,siteId,date:text(input.date)||occurredAt.slice(0,10),status}
 return{aggregateType:'mirfe.water-analysis',aggregateId,eventName:DomainEvents.MIRFE_WATER_ANALYSIS_RECORDED,siteId,eventPayload:{waterAnalysisId:aggregateId,siteId,status,laboratory:text(input.laboratory)},collection:'waterAnalyses',apply:current=>mutateIrrigationMirfeState(current,tenant=>{
  const items=status==='Vigente'?list(tenant.waterAnalyses).map(item=>item.siteId===siteId&&item.status==='Vigente'?{...item,status:'Histórico'}:item):list(tenant.waterAnalyses)
  if(items.some(item=>item.id===aggregateId))throw new Error('waterAnalyses ya contiene ese id en la empresa activa.')
  return{...tenant,waterAnalyses:[...items,record]}
 })}
}

function planNutrientProduct(input,aggregateId,organizationId){
 const name=required(input.name,'name'),inventoryProductId=required(input.inventoryProductId,'inventoryProductId'),record={id:aggregateId,...input,organizationId,name,inventoryProductId}
 return{aggregateType:'mirfe.nutrient-product',aggregateId,eventName:DomainEvents.MIRFE_NUTRIENT_PRODUCT_CREATED,siteId:null,eventPayload:{nutrientProductId:aggregateId,name,inventoryProductId},collection:'nutrientProducts',apply:current=>appendRecord(current,'nutrientProducts',record)}
}

function planNutrientObjective(input,aggregateId,organizationId,occurredAt){
 const geneticId=required(input.geneticId,'geneticId'),stage=required(input.stage,'stage'),record={id:aggregateId,...input,organizationId,geneticId,stage,recordedAt:occurredAt}
 return{aggregateType:'mirfe.nutrient-objective',aggregateId,eventName:DomainEvents.MIRFE_NUTRIENT_OBJECTIVE_RECORDED,siteId:null,eventPayload:{nutrientObjectiveId:aggregateId,geneticId,stage,status:text(input.status)||'Borrador'},collection:'nutrientObjectives',apply:current=>mutateIrrigationMirfeState(current,tenant=>{
  const items=list(tenant.nutrientObjectives).map(item=>item.geneticId===geneticId&&item.stage===stage&&item.status!=='Inactiva'?{...item,status:'Inactiva',supersededByObjectiveId:aggregateId}:item)
  if(items.some(item=>item.id===aggregateId))throw new Error('nutrientObjectives ya contiene ese id en la empresa activa.')
  return{...tenant,nutrientObjectives:[...items,record]}
 })}
}

function latestFormulaVersion(tenant,input,{siteId,geneticId,stage}){
 const explicitPreviousId=text(input.supersedesFormulaId)
 if(explicitPreviousId){
  const matches=list(tenant.formulations).filter(item=>item.id===explicitPreviousId)
  if(matches.length!==1)throw new Error('La fórmula anterior no existe de forma inequívoca en la empresa activa.')
  return matches[0]
 }
 const formulaKey=text(input.formulaKey)
 const candidates=list(tenant.formulations).filter(item=>formulaKey?(text(item.formulaKey||item.id)===formulaKey):(item.siteId===siteId&&text(item.geneticId)===geneticId&&item.stage===stage))
 return candidates.sort((left,right)=>(Number(right.version||1)-Number(left.version||1))||(Date.parse(right.createdAt||right.date||0)-Date.parse(left.createdAt||left.date||0)))[0]||null
}

function formulationEvidence(tenant,{siteId,geneticId,stage,items,volumeLiters},approved){
 const objectives=list(tenant.nutrientObjectives).filter(item=>item.geneticId===geneticId&&item.stage===stage&&item.status==='Aprobada')
 const waters=list(tenant.waterAnalyses).filter(item=>item.siteId===siteId&&item.status==='Vigente')
 const objective=objectives.at(-1),water=waters.at(-1)
 if(approved&&!objective)throw new Error('No se puede aprobar sin un objetivo nutricional aprobado para genética y etapa.')
 if(approved&&!water)throw new Error('No se puede aprobar sin un análisis de agua vigente para la sede.')
 const productIds=[...new Set(items.map(item=>text(item?.productId)).filter(Boolean))],products=[]
 for(const productId of productIds){
  const matches=list(tenant.nutrientProducts).filter(item=>item.id===productId)
  if(matches.length!==1)throw new Error(`El producto nutricional ${productId} no existe de forma inequívoca en la empresa activa.`)
  products.push(matches[0])
 }
 const targetSnapshot=objective&&water?netTargets(objective,water):Object.fromEntries(FORMULATION_NUTRIENTS.map(key=>[key,0]))
 const validation=objective&&water?validateFormula(products,items,targetSnapshot,volumeLiters):{
  totals:Object.fromEntries(FORMULATION_NUTRIENTS.map(key=>[key,0])),
  deviations:Object.fromEntries(FORMULATION_NUTRIENTS.map(key=>[key,0])),
  warnings:[...(!objective?['Falta objetivo nutricional aprobado.']:[]),...(!water?['Falta análisis de agua vigente.']:[])],
  valid:false
 }
 if(approved&&!validation.valid)throw new Error(`La fórmula no puede aprobarse: ${validation.warnings.join(' ')}`)
 const productSnapshots=products.map(product=>({id:product.id,name:text(product.name),inventoryProductId:text(product.inventoryProductId),tank:text(product.tank)||'A',purity:Number(product.purity??100),solubilityGramsPerLiter:Number(product.solubilityGramsPerLiter??product.solubility??0),composition:normalizedComposition(product)}))
 return{objective,water,targetSnapshot,productSnapshots,validation,waterSnapshot:water?normalizedWaterComposition(water):Object.fromEntries(FORMULATION_NUTRIENTS.map(key=>[key,0]))}
}

function planFormulation(state,input,aggregateId,organizationId,occurredAt,approved){
 const tenant=activeTenantState(state,organizationId),siteId=required(input.siteId,'siteId'),geneticId=required(input.geneticId,'geneticId'),stage=required(input.stage,'stage'),items=list(input.items),volumeLiters=finite(input.volumeLiters??input.volumeL,'volumeL',{positive:true})
 if(!items.length)throw new Error('La formulación requiere al menos un producto calculado.')
 const previous=latestFormulaVersion(tenant,input,{siteId,geneticId,stage})
 if(previous&&(previous.siteId!==siteId||text(previous.geneticId)!==geneticId||previous.stage!==stage))throw new Error('La nueva versión debe conservar sede, genética y etapa de su lineage.')
 const evidence=formulationEvidence(tenant,{siteId,geneticId,stage,items,volumeLiters},approved),user=activeUser(state),status=approved?'Aprobada':'Borrador'
 const canonicalInput={id:aggregateId,organizationId,siteId,formulaKey:previous?.formulaKey||text(input.formulaKey)||aggregateId,name:text(input.name)||`${stage} · ${geneticId}`,stage,geneticId,volumeLiters,items,nutrientObjectiveId:text(evidence.objective?.id),waterAnalysisId:text(evidence.water?.id),targetSnapshot:evidence.targetSnapshot,productSnapshots:evidence.productSnapshots,validation:{...evidence.validation,waterSnapshot:evidence.waterSnapshot},status,createdAt:occurredAt,approvedBy:approved?(user?.name||'Usuario local'):'',approvedAt:approved?occurredAt:''}
 const formula=previous?nextFertigationFormulaVersion(previous,canonicalInput):createFertigationFormula(canonicalInput)
 const record={...formula,date:occurredAt,volumeL:formula.volumeLiters}
 return{aggregateType:'mirfe.formulation',aggregateId,eventName:approved?DomainEvents.MIRFE_FORMULA_APPROVED:DomainEvents.MIRFE_FORMULA_CREATED,siteId,eventPayload:{formulationId:aggregateId,formulaKey:formula.formulaKey,formulaVersion:formula.version,supersedesFormulaId:formula.supersedesFormulaId,siteId,geneticId,stage,status,volumeLiters:formula.volumeLiters,nutrientObjectiveId:formula.nutrientObjectiveId,waterAnalysisId:formula.waterAnalysisId,validationValid:formula.validation.valid,warningCount:list(formula.validation.warnings).length},collection:'formulations',apply:current=>appendRecord(current,'formulations',record)}
}

function tenantRecord(state,organizationId,collection,id,label){
 const record=list(activeTenantState(state,organizationId)?.[collection]).find(item=>item.id===id)
 if(!record)throw new Error(`${label} no existe en la empresa activa.`)
 return record
}

function planPreparation(state,input,aggregateId,organizationId,occurredAt){
 const formulationId=required(input.formulationId,'formulationId'),formula=tenantRecord(state,organizationId,'formulations',formulationId,'La formulación'),siteId=required(formula.siteId,'siteId de la formulación')
 return{aggregateType:'mirfe.preparation',aggregateId,eventName:DomainEvents.MIRFE_PREPARATION_CREATED,siteId,eventPayload:{preparationId:aggregateId,formulationId,formulaKey:text(formula.formulaKey||formula.id),formulaVersion:Number(formula.version||1),siteId,volumeLiters:Number(formula.volumeLiters??formula.volumeL??0)},collection:'tankPreparations',apply:current=>createTankPreparation(current,{...input,id:aggregateId,formulationId,createdAt:occurredAt})}
}

function planExecution(state,input,organizationId,occurredAt,commandId){
 const preparationId=required(input.preparationId,'preparationId'),preparation=tenantRecord(state,organizationId,'tankPreparations',preparationId,'La preparación'),siteId=required(preparation.siteId,'siteId de la preparación')
 return{aggregateType:'mirfe.preparation',aggregateId:preparationId,eventName:DomainEvents.MIRFE_PREPARATION_COMPLETED,siteId,eventPayload:{preparationId,formulationId:text(preparation.formulationId),siteId},collection:'tankPreparations',apply:current=>executeTankPreparation(current,{...input,preparationId,executedAt:occurredAt,movementIdPrefix:`${commandId}:movement`,costEntryId:`${commandId}:cost`,workOrderId:`${commandId}:work-order`})}
}

function planApplication(state,input,aggregateId,organizationId,occurredAt){
 const preparationId=required(input.preparationId,'preparationId'),preparation=tenantRecord(state,organizationId,'tankPreparations',preparationId,'La preparación'),siteId=required(preparation.siteId,'siteId de la preparación')
 return{aggregateType:'mirfe.application',aggregateId,eventName:DomainEvents.MIRFE_APPLICATION_COMPLETED,siteId,eventPayload:{applicationId:aggregateId,preparationId,formulationId:text(preparation.formulationId),formulaKey:text(preparation.formulaKey),formulaVersion:Number(preparation.formulaVersion||1),siteId,volumeLiters:Number(input.volumeL||preparation.volumeL||0)},collection:'irrigationApplications',apply:current=>registerIrrigationApplication(current,{...input,id:aggregateId,preparationId,createdAt:occurredAt})}
}

function buildPlan(state,operation,input,aggregateId,organizationId,occurredAt,commandId){
 if(operation===IRRIGATION_MIRFE_OPERATIONS.CREATE_IRRIGATION_PLAN)return planIrrigation(state,input,aggregateId,organizationId,occurredAt)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.RECORD_WATER_ANALYSIS)return planWaterAnalysis(input,aggregateId,organizationId,occurredAt)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.CREATE_NUTRIENT_PRODUCT)return planNutrientProduct(input,aggregateId,organizationId)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.RECORD_NUTRIENT_OBJECTIVE)return planNutrientObjective(input,aggregateId,organizationId,occurredAt)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.CREATE_FORMULATION)return planFormulation(state,input,aggregateId,organizationId,occurredAt,false)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.APPROVE_FORMULATION)return planFormulation(state,input,aggregateId,organizationId,occurredAt,true)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.CREATE_PREPARATION)return planPreparation(state,input,aggregateId,organizationId,occurredAt)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.EXECUTE_PREPARATION)return planExecution(state,input,organizationId,occurredAt,commandId)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.REGISTER_APPLICATION)return planApplication(state,input,aggregateId,organizationId,occurredAt)
 throw new Error('Operación Irrigation/MIRFE no soportada.')
}

export async function executeIrrigationMirfeCommand(state,{operation,input={},entityId='',commandId,occurredAt}={},deps={}){
 const normalizedOperation=required(operation,'operation'),normalizedCommandId=required(commandId,'commandId')
 if(!knownOperation(normalizedOperation))throw new Error('Operación Irrigation/MIRFE no soportada.')
 if(!plainObject(input))throw new Error('input debe ser un objeto.')
 const organizationId=activeOrganizationId(state),declaredOwner=explicitOrganizationId(input)
 if(declaredOwner&&declaredOwner!==organizationId)throw new Error('La operación MIRFE declara otra empresa.')
 const provisionalAggregateId=text(entityId||input.id||(normalizedOperation===IRRIGATION_MIRFE_OPERATIONS.EXECUTE_PREPARATION?input.preparationId:normalizedCommandId))
 const signature=irrigationMirfeCommandSignature({operation:normalizedOperation,aggregateId:provisionalAggregateId,input}),existing=findReceipt(state,organizationId,normalizedCommandId)
 assertReceipt(existing?.receipt,signature)
 const initialSiteId=text(existing?.receipt?.siteId||input.siteId||state.currentContext?.siteId)
 authorize(state,normalizedOperation,organizationId,initialSiteId)
 const effectiveOccurredAt=existing?.receipt?.occurredAt||occurredAt||new Date().toISOString()
 if(Number.isNaN(Date.parse(effectiveOccurredAt)))throw new Error('occurredAt no es válido.')
 const plan=existing?{aggregateType:existing.receipt.aggregateType,aggregateId:existing.receipt.aggregateId,eventName:existing.receipt.eventName,siteId:existing.receipt.siteId,eventPayload:existing.receipt.eventPayload,collection:existing.collection,apply:current=>current}:buildPlan(state,normalizedOperation,input,provisionalAggregateId,organizationId,effectiveOccurredAt,normalizedCommandId)
 authorize(state,normalizedOperation,organizationId,plan.siteId)
 const receipt=existing?.receipt||Object.freeze({commandId:normalizedCommandId,signature,operation:normalizedOperation,occurredAt:effectiveOccurredAt,aggregateType:plan.aggregateType,aggregateId:plan.aggregateId,eventName:plan.eventName,siteId:plan.siteId,eventPayload:plan.eventPayload})
 const publishEvent=deps.publishEvent,commit=deps.commit
 if(typeof publishEvent!=='function')throw new TypeError('publishEvent es obligatorio para ejecutar comandos Irrigation/MIRFE.')
 if(typeof commit!=='function')throw new TypeError('commit es obligatorio para ejecutar comandos Irrigation/MIRFE.')
 const localApply=current=>applyOnce(current,organizationId,receipt,plan.collection,plan.aggregateId,plan.apply)
 const remoteInventory=normalizedOperation===IRRIGATION_MIRFE_OPERATIONS.EXECUTE_PREPARATION&&!existing&&typeof deps.commitInventoryTransaction==='function'
 const transaction=remoteInventory?buildMirfeInventoryTransaction(state,localApply(state),{commandId:normalizedCommandId,signature,organizationId,preparationId:plan.aggregateId}):null
 const prepareCommit=remoteInventory?()=>deps.commitInventoryTransaction(transaction):null
 const apply=remoteInventory?(current,confirmation)=>{
  if(activeOrganizationId(current)!==organizationId)throw new Error('La empresa activa cambió antes de confirmar la operación MIRFE.')
  return applyMirfeInventoryConfirmation(current,confirmation,organizationId)
 }:localApply
 await executeCoreOperationCommand({commandId:normalizedCommandId,organizationId,siteId:plan.siteId,aggregateType:plan.aggregateType,aggregateId:plan.aggregateId,completedEventName:plan.eventName,occurredAt:effectiveOccurredAt,payload:plan.eventPayload,metadata:{module:'irrigation-mirfe',operation:normalizedOperation,remoteInventory},prepareCommit,commitMeta:remoteInventory?{sync:false}:{},apply},{publishEvent,commit})
 return Object.freeze({ok:true,replay:Boolean(existing),commandId:normalizedCommandId,aggregateId:plan.aggregateId,eventName:plan.eventName})
}
