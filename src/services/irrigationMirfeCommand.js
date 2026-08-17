import{DomainEvents}from'../core/events/eventCatalog.js'
import{FORMULATION_NUTRIENTS,netTargets,normalizedComposition,normalizedWaterComposition,validateFormula}from'../domain/formulation.js'
import{createFertigationFormula,nextFertigationFormulaVersion}from'../domain/irrigationMirfe.js'
import{irrigationHydraulicsForPlan}from'../domain/irrigationTopology.js'
import{MIRFE_HISTORY_TYPES,MIRFE_WORKFLOW_TRANSITIONS,createMirfeCorrection,createMirfeHistoryEntry,createMirfeMonitoring,createMirfeProgram,createMirfeReinforcement,transitionMirfeReinforcement}from'../domain/mirfeWorkflow.js'
import{activeOrganizationId,explicitOrganizationId}from'../domain/organizationOwnership.js'
import{createTankPreparation,executeTankPreparation,registerIrrigationApplication}from'../domain/irrigationExecution.js'
import{IRRIGATION_MIRFE_OWNERSHIP_COLLECTIONS,mutateIrrigationMirfeState,scopeIrrigationMirfeState}from'../domain/irrigationMirfeTenancy.js'
import{assertWaterSampleIdentity,createWaterAnalysisVersion,currentWaterAnalysisForSite,WATER_FORMULATION_ANALYTES}from'../domain/waterAnalysis.js'
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
 REGISTER_APPLICATION:'REGISTER_APPLICATION',
 CREATE_MIRFE_PROGRAM:'CREATE_MIRFE_PROGRAM',
 RECORD_MIRFE_MONITORING:'RECORD_MIRFE_MONITORING',
 CREATE_MIRFE_REINFORCEMENT:'CREATE_MIRFE_REINFORCEMENT',
 TRANSITION_MIRFE_REINFORCEMENT:'TRANSITION_MIRFE_REINFORCEMENT',
 RECORD_MIRFE_CORRECTION:'RECORD_MIRFE_CORRECTION'
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
 if([IRRIGATION_MIRFE_OPERATIONS.CREATE_MIRFE_PROGRAM,IRRIGATION_MIRFE_OPERATIONS.RECORD_MIRFE_MONITORING,IRRIGATION_MIRFE_OPERATIONS.CREATE_MIRFE_REINFORCEMENT,IRRIGATION_MIRFE_OPERATIONS.TRANSITION_MIRFE_REINFORCEMENT,IRRIGATION_MIRFE_OPERATIONS.RECORD_MIRFE_CORRECTION].includes(operation))return'manage_mirfe'
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

function appendRecordAndHistory(current,collection,record,history){
 return mutateIrrigationMirfeState(current,tenant=>{
  const records=list(tenant?.[collection]),historyItems=list(tenant?.irrigationHistory)
  if(records.some(item=>item.id===record.id))throw new Error(`${collection} ya contiene ese id en la empresa activa.`)
  if(historyItems.some(item=>item.id===history.id))throw new Error('irrigationHistory ya contiene ese id en la empresa activa.')
  return{...tenant,[collection]:[...records,record],irrigationHistory:[...historyItems,history]}
 })
}

function commandActor(state){
 const user=activeUser(state)
 return{id:text(user?.remoteId||user?.id)||'system',name:text(user?.name)||'Sistema'}
}

function activeTenantState(state,organizationId){return scopeIrrigationMirfeState(state,organizationId)}

function planIrrigation(state,input,aggregateId,organizationId,occurredAt){
 const tenant=activeTenantState(state,organizationId),siteId=required(input.siteId,'siteId'),houseId=text(input.houseId),sectorId=text(input.sectorId),geneticId=text(input.geneticId)
 const rows=list(tenant.beds).filter(bed=>!houseId||bed.houseId===houseId).filter(bed=>!geneticId||bed.geneticId===geneticId).map(bed=>({...bed,drippers:bed.drippers||1,flow:bed.flow||2}))
 const apps=finite(input.apps,'apps',{positive:true}),minutes=finite(input.minutes,'minutes',{positive:true}),tank=finite(input.tank,'tank',{positive:true})
 const result=irrigationHydraulicsForPlan(state,{organizationId,siteId,houseId,sectorId,geneticId,at:occurredAt,apps,minutes,tank,planId:aggregateId,legacyRows:rows})
 const water=currentWaterAnalysisForSite(tenant.waterAnalyses,{organizationId,siteId})
 const stage=text(input.stage),date=text(input.date)||occurredAt.slice(0,10),loadSchedule=result.loadSchedule.map(load=>({...load,organizationId,irrigationPlanId:aggregateId,siteId,houseId,sectorId,geneticId,stage,date,status:'PLANNED'}))
 const record={id:aggregateId,organizationId,date,siteId,houseId,sectorId,geneticId,stage,apps:result.applicationCount,minutes,tank:result.tankCapacityLiters,...result,loadSchedule,waterStatus:water?'Vigente':'Pendiente'}
 return{aggregateType:'mirfe.irrigation-plan',aggregateId,eventName:DomainEvents.MIRFE_IRRIGATION_PLAN_CREATED,siteId,eventPayload:{planId:aggregateId,siteId,houseId,sectorId,geneticId,plants:result.plants,dailyLiters:result.daily,tankCapacityLiters:result.tankCapacityLiters,preparationsPerApplication:result.preparationsPerApplication,preparationCount:result.preparationCount,loads:result.loads,calculationMode:result.calculationMode,assignmentCount:result.assignmentCount,sectorCount:result.sectorCount,emitterCount:result.emitterCount},collection:'irrigationPlans',apply:current=>appendRecord(current,'irrigationPlans',record)}
}

function latestWaterAnalysisVersion(tenant,input){
 const previousId=text(input.supersedesWaterAnalysisId)
 if(previousId){
  const matches=list(tenant.waterAnalyses).filter(item=>item.id===previousId)
  if(matches.length!==1)throw new Error('El análisis de agua anterior no existe de forma inequívoca en la empresa activa.')
  return matches[0]
 }
 const analysisKey=text(input.analysisKey)
 if(!analysisKey)return null
 const candidates=list(tenant.waterAnalyses).filter(item=>text(item.analysisKey||item.id)===analysisKey)
 if(!candidates.length)return null
 const versions=candidates.map(item=>Number(item.version||1))
 if(new Set(versions).size!==versions.length)throw new Error('El lineage del análisis de agua contiene una versión duplicada.')
 return candidates.sort((left,right)=>Number(right.version||1)-Number(left.version||1)||Date.parse(right.reportedAt||right.date||0)-Date.parse(left.reportedAt||left.date||0))[0]
}

function planWaterAnalysis(state,input,aggregateId,organizationId,occurredAt){
 const tenant=activeTenantState(state,organizationId),siteId=required(input.siteId,'siteId'),previous=latestWaterAnalysisVersion(tenant,input)
 const siteMatches=list(tenant.sites).filter(item=>item.id===siteId)
 if(siteMatches.length!==1)throw new Error(siteMatches.length?'La sede del análisis de agua tiene identidad duplicada.':'La sede del análisis de agua no existe en la empresa activa.')
 if(list(tenant.waterAnalyses).some(item=>item.id===aggregateId))throw new Error('waterAnalyses ya contiene ese id en la empresa activa.')
 const record=createWaterAnalysisVersion({...input,id:aggregateId,organizationId,siteId,reportedAt:occurredAt},previous)
 assertWaterSampleIdentity(tenant.waterAnalyses,record)
 return{aggregateType:'mirfe.water-analysis',aggregateId,eventName:DomainEvents.MIRFE_WATER_ANALYSIS_RECORDED,siteId,eventPayload:{waterAnalysisId:aggregateId,analysisKey:record.analysisKey,version:record.version,supersedesWaterAnalysisId:record.supersedesWaterAnalysisId,siteId,status:record.status,laboratoryId:record.laboratoryId,laboratory:record.laboratoryName,sampleId:record.sampleId,resultCount:record.completeness.resultCount,complete:record.completeness.complete,partial:!record.completeness.complete},collection:'waterAnalyses',apply:current=>appendRecord(current,'waterAnalyses',record)}
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

function formulationEvidence(tenant,{organizationId,siteId,geneticId,stage,items,volumeLiters},approved){
 const objectives=list(tenant.nutrientObjectives).filter(item=>item.geneticId===geneticId&&item.stage===stage&&item.status==='Aprobada')
 const objective=objectives.at(-1),water=currentWaterAnalysisForSite(tenant.waterAnalyses,{organizationId,siteId,requiredAnalytes:WATER_FORMULATION_ANALYTES})
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
 const evidence=formulationEvidence(tenant,{organizationId,siteId,geneticId,stage,items,volumeLiters},approved),user=activeUser(state),status=approved?'Aprobada':'Borrador'
 const canonicalInput={id:aggregateId,organizationId,siteId,formulaKey:previous?.formulaKey||text(input.formulaKey)||aggregateId,name:text(input.name)||`${stage} · ${geneticId}`,stage,geneticId,volumeLiters,items,nutrientObjectiveId:text(evidence.objective?.id),waterAnalysisId:text(evidence.water?.id),targetSnapshot:evidence.targetSnapshot,productSnapshots:evidence.productSnapshots,validation:{...evidence.validation,waterSnapshot:evidence.waterSnapshot},status,createdAt:occurredAt,approvedBy:approved?(user?.name||'Usuario local'):'',approvedAt:approved?occurredAt:''}
 const formula=previous?nextFertigationFormulaVersion(previous,canonicalInput):createFertigationFormula(canonicalInput)
 const record={...formula,date:occurredAt,volumeL:formula.volumeLiters}
 return{aggregateType:'mirfe.formulation',aggregateId,eventName:approved?DomainEvents.MIRFE_FORMULA_APPROVED:DomainEvents.MIRFE_FORMULA_CREATED,siteId,eventPayload:{formulationId:aggregateId,formulaKey:formula.formulaKey,formulaVersion:formula.version,supersedesFormulaId:formula.supersedesFormulaId,siteId,geneticId,stage,status,volumeLiters:formula.volumeLiters,nutrientObjectiveId:formula.nutrientObjectiveId,waterAnalysisId:formula.waterAnalysisId,validationValid:formula.validation.valid,warningCount:list(formula.validation.warnings).length},collection:'formulations',apply:current=>appendRecord(current,'formulations',record)}
}

function tenantRecord(state,organizationId,collection,id,label){
 const matches=list(activeTenantState(state,organizationId)?.[collection]).filter(item=>item.id===id)
 if(matches.length!==1)throw new Error(matches.length?`${label} tiene identidad duplicada en la empresa activa.`:`${label} no existe en la empresa activa.`)
 return matches[0]
}

function irrigationPlanLoad(state,organizationId,planId,loadId){
 const plan=tenantRecord(state,organizationId,'irrigationPlans',planId,'El plan de riego'),matches=list(plan.loadSchedule).filter(item=>text(item.id)===loadId)
 if(matches.length!==1)throw new Error(matches.length?'La carga planificada tiene identidad duplicada.':'La carga no existe en el plan de riego activo.')
 return{plan,load:matches[0]}
}

function reserveIrrigationPlanLoad(state,organizationId,planId,loadId,preparationId,reservedAt){
 return mutateIrrigationMirfeState(state,tenant=>{
  const plans=list(tenant.irrigationPlans),matches=plans.filter(item=>item.id===planId)
  if(matches.length!==1)throw new Error('El plan de riego cambió antes de reservar la carga.')
  const plan=matches[0],loads=list(plan.loadSchedule),loadMatches=loads.filter(item=>item.id===loadId)
  if(loadMatches.length!==1||loadMatches[0].status!=='PLANNED'||text(loadMatches[0].preparationId))throw new Error('La carga planificada ya no está disponible.')
  const updated={...plan,loadSchedule:loads.map(item=>item.id===loadId?{...item,status:'PREPARATION_CREATED',preparationId,reservedAt}:item)}
  return{...tenant,irrigationPlans:plans.map(item=>item.id===planId?updated:item)}
 })
}

function planPreparation(state,input,aggregateId,organizationId,occurredAt){
 const formulationId=required(input.formulationId,'formulationId'),formula=tenantRecord(state,organizationId,'formulations',formulationId,'La formulación'),siteId=required(formula.siteId,'siteId de la formulación'),irrigationPlanId=text(input.irrigationPlanId),loadId=text(input.loadId),scheduled=Boolean(irrigationPlanId||loadId)
 if(scheduled&&(!irrigationPlanId||!loadId))throw new Error('Una preparación planificada requiere irrigationPlanId y loadId.')
 const scheduledRecord=scheduled?irrigationPlanLoad(state,organizationId,irrigationPlanId,loadId):null,plan=scheduledRecord?.plan,load=scheduledRecord?.load
 if(scheduled){
  if(load.status!=='PLANNED'||text(load.preparationId))throw new Error('La carga planificada ya tiene una preparación.')
  if(plan.siteId!==siteId)throw new Error('La fórmula y el plan de riego pertenecen a sedes diferentes.')
  if(text(plan.stage)&&text(formula.stage)!==text(plan.stage))throw new Error('La fórmula no corresponde a la etapa del plan de riego.')
  if(text(plan.geneticId)&&text(formula.geneticId)!==text(plan.geneticId))throw new Error('La fórmula no corresponde a la genética del plan de riego.')
 }
 const volumeLiters=scheduled?Number(load.volumeLiters):Number(formula.volumeLiters??formula.volumeL??0)
 const apply=current=>{
  const created=createTankPreparation(current,{...input,id:aggregateId,formulationId,volumeL:volumeLiters,createdAt:occurredAt,...(scheduled?{irrigationPlanId,loadId,applicationSequence:load.applicationSequence,loadSequence:load.loadSequence,date:load.date||plan.date}:{})})
  return scheduled?reserveIrrigationPlanLoad(created,organizationId,irrigationPlanId,loadId,aggregateId,occurredAt):created
 }
 return{aggregateType:'mirfe.preparation',aggregateId,eventName:DomainEvents.MIRFE_PREPARATION_CREATED,siteId,eventPayload:{preparationId:aggregateId,formulationId,formulaKey:text(formula.formulaKey||formula.id),formulaVersion:Number(formula.version||1),siteId,volumeLiters,irrigationPlanId,loadId,applicationSequence:Number(load?.applicationSequence||0),loadSequence:Number(load?.loadSequence||0)},collection:'tankPreparations',apply}
}

function planExecution(state,input,organizationId,occurredAt,commandId){
 const preparationId=required(input.preparationId,'preparationId'),preparation=tenantRecord(state,organizationId,'tankPreparations',preparationId,'La preparación'),siteId=required(preparation.siteId,'siteId de la preparación')
 return{aggregateType:'mirfe.preparation',aggregateId:preparationId,eventName:DomainEvents.MIRFE_PREPARATION_COMPLETED,siteId,eventPayload:{preparationId,formulationId:text(preparation.formulationId),siteId},collection:'tankPreparations',apply:current=>executeTankPreparation(current,{...input,preparationId,executedAt:occurredAt,movementIdPrefix:`${commandId}:movement`,costEntryId:`${commandId}:cost`,workOrderId:`${commandId}:work-order`})}
}

function planApplication(state,input,aggregateId,organizationId,occurredAt){
 const preparationId=required(input.preparationId,'preparationId'),preparation=tenantRecord(state,organizationId,'tankPreparations',preparationId,'La preparación'),siteId=required(preparation.siteId,'siteId de la preparación')
 return{aggregateType:'mirfe.application',aggregateId,eventName:DomainEvents.MIRFE_APPLICATION_COMPLETED,siteId,eventPayload:{applicationId:aggregateId,preparationId,formulationId:text(preparation.formulationId),formulaKey:text(preparation.formulaKey),formulaVersion:Number(preparation.formulaVersion||1),siteId,volumeLiters:Number(input.volumeL||preparation.volumeL||0)},collection:'irrigationApplications',apply:current=>registerIrrigationApplication(current,{...input,id:aggregateId,preparationId,createdAt:occurredAt})}
}

function mirfeLocation(state,organizationId,input,{bed=false,genetic=false}={}){
 const siteId=required(input.siteId,'siteId'),site=tenantRecord(state,organizationId,'sites',siteId,'La sede')
 const houseId=required(input.houseId,'houseId'),house=tenantRecord(state,organizationId,'houses',houseId,'La nave')
 if(house.siteId!==site.id)throw new Error('La nave no pertenece a la sede seleccionada.')
 const bedId=text(input.bedId)
 if(bedId){const record=tenantRecord(state,organizationId,'beds',bedId,'La cama');if(record.houseId!==houseId)throw new Error('La cama no pertenece a la nave seleccionada.')}
 const geneticId=text(input.geneticId)
 if(genetic){const record=tenantRecord(state,organizationId,'genetics',required(geneticId,'geneticId'),'La genética');if(record.organizationId&&record.organizationId!==organizationId)throw new Error('La genética pertenece a otra empresa.')}
 return{siteId,houseId,bedId,geneticId}
}

function planMirfeProgram(state,input,aggregateId,organizationId,occurredAt,commandId){
 const actor=commandActor(state),siteId=text(input.siteId),houseId=text(input.houseId),geneticId=text(input.geneticId)||'Todos'
 if(siteId)tenantRecord(state,organizationId,'sites',siteId,'La sede')
 if(houseId){const house=tenantRecord(state,organizationId,'houses',houseId,'La nave');if(!siteId||house.siteId!==siteId)throw new Error('La nave del programa no pertenece a la sede seleccionada.')}
 if(geneticId!=='Todos')tenantRecord(state,organizationId,'genetics',geneticId,'La genética')
 const record=createMirfeProgram({...input,id:aggregateId,organizationId,siteId,houseId,geneticId,createdAt:occurredAt,createdBy:actor.id})
 const eventPayload={programId:aggregateId,siteId,name:record.name,category:record.category,geneticId:record.geneticId,stage:record.stage,status:record.status,summary:`${record.name} · ${record.stage}`}
 const history=createMirfeHistoryEntry({id:`${commandId}:history`,organizationId,siteId,type:MIRFE_HISTORY_TYPES.PROGRAM_CREATED,eventName:DomainEvents.MIRFE_PROGRAM_CREATED,entityType:'mirfe.program',entityId:aggregateId,occurredAt,actorId:actor.id,summary:`Programa ${record.name} creado`,to:record.status,evidence:{category:record.category,geneticId:record.geneticId,stage:record.stage}})
 return{aggregateType:'mirfe.program',aggregateId,eventName:DomainEvents.MIRFE_PROGRAM_CREATED,siteId,eventPayload,collection:'mirfePrograms',apply:current=>appendRecordAndHistory(current,'mirfePrograms',record,history)}
}

function planMirfeMonitoring(state,input,aggregateId,organizationId,occurredAt,commandId){
 const actor=commandActor(state),location=mirfeLocation(state,organizationId,input,{bed:true,genetic:true})
 const record=createMirfeMonitoring({...input,...location,id:aggregateId,organizationId,recordedAt:occurredAt,recordedBy:actor.id})
 const eventPayload={monitoringId:aggregateId,siteId:location.siteId,houseId:location.houseId,bedId:location.bedId,geneticId:location.geneticId,stage:record.stage,observedAt:record.observedAt,vpd:record.vpd,deltaEc:record.deltaEc,drainPercent:record.drainPercent,summary:`${record.stage} · ΔEC ${record.deltaEc.toFixed(2)}`}
 const history=createMirfeHistoryEntry({id:`${commandId}:history`,organizationId,siteId:location.siteId,type:MIRFE_HISTORY_TYPES.MONITORING_RECORDED,eventName:DomainEvents.MIRFE_MONITORING_RECORDED,entityType:'mirfe.monitoring',entityId:aggregateId,occurredAt,actorId:actor.id,summary:`Monitoreo ${record.stage} registrado`,evidence:{houseId:record.houseId,geneticId:record.geneticId,vpd:record.vpd,deltaEc:record.deltaEc,diagnosis:record.diagnosis}})
 return{aggregateType:'mirfe.monitoring',aggregateId,eventName:DomainEvents.MIRFE_MONITORING_RECORDED,siteId:location.siteId,eventPayload,collection:'mirfeMonitoring',apply:current=>appendRecordAndHistory(current,'mirfeMonitoring',record,history)}
}

function planMirfeReinforcement(state,input,aggregateId,organizationId,occurredAt,commandId){
 const actor=commandActor(state),location=mirfeLocation(state,organizationId,input,{bed:true,genetic:true})
 const programId=text(input.programId),monitoringId=text(input.monitoringId),program=programId?tenantRecord(state,organizationId,'mirfePrograms',programId,'El programa MIRFE'):null,monitoring=monitoringId?tenantRecord(state,organizationId,'mirfeMonitoring',monitoringId,'El monitoreo MIRFE'):null,product=tenantRecord(state,organizationId,'products',required(input.productId,'productId'),'El producto')
 if(program&&program.status!=='ACTIVE')throw new Error('El programa MIRFE no está activo.')
 if(program&&program.siteId&&program.siteId!==location.siteId)throw new Error('El programa MIRFE no corresponde a la sede seleccionada.')
 if(program&&program.houseId&&program.houseId!==location.houseId)throw new Error('El programa MIRFE no corresponde a la nave seleccionada.')
 if(program&&program.geneticId!=='Todos'&&program.geneticId!==location.geneticId)throw new Error('El programa MIRFE no corresponde a la genética seleccionada.')
 if(program&&program.stage!==input.stage)throw new Error('El programa MIRFE no corresponde a la etapa seleccionada.')
 if(monitoring&&[monitoring.siteId!==location.siteId,monitoring.houseId!==location.houseId,monitoring.geneticId!==location.geneticId,monitoring.stage!==input.stage].some(Boolean))throw new Error('El monitoreo MIRFE no corresponde al contexto del refuerzo.')
 if(!['MIRFE','Fertilizante','Adyuvante','Corrector pH'].includes(product.category))throw new Error('El producto no pertenece al catálogo de insumos admitidos para refuerzos MIRFE.')
 const record=createMirfeReinforcement({...input,...location,id:aggregateId,organizationId,createdAt:occurredAt,createdBy:actor.id,createdByName:actor.name,workflowEventId:`${commandId}:workflow`},{program,monitoring,product})
 const eventPayload={reinforcementId:aggregateId,siteId:record.siteId,houseId:record.houseId,geneticId:record.geneticId,programId:record.programId,monitoringId:record.monitoringId,productId:record.productId,status:record.status,workflowVersion:record.workflowVersion,quantityApplied:record.quantityApplied,summary:`${record.category} · ${record.reason}`}
 const history=createMirfeHistoryEntry({id:`${commandId}:history`,organizationId,siteId:record.siteId,type:MIRFE_HISTORY_TYPES.REINFORCEMENT_CREATED,eventName:DomainEvents.MIRFE_REINFORCEMENT_CREATED,entityType:'mirfe.reinforcement',entityId:aggregateId,reinforcementId:aggregateId,occurredAt,actorId:actor.id,summary:`Refuerzo ${record.reason} creado`,to:record.status,evidence:{programId:record.programId,monitoringId:record.monitoringId,productId:record.productId,quantityApplied:record.quantityApplied}})
 return{aggregateType:'mirfe.reinforcement',aggregateId,eventName:DomainEvents.MIRFE_REINFORCEMENT_CREATED,siteId:record.siteId,eventPayload,collection:'mirfeReinforcements',apply:current=>appendRecordAndHistory(current,'mirfeReinforcements',record,history)}
}

function planMirfeTransition(state,input,aggregateId,organizationId,occurredAt,commandId){
 const actor=commandActor(state),record=tenantRecord(state,organizationId,'mirfeReinforcements',aggregateId,'El refuerzo MIRFE'),transition=required(input.transition,'transition'),expectedVersion=Number(record.workflowVersion||record.workflow?.version||0)
 if(record.workflowQuarantined)throw new Error('El refuerzo MIRFE está en cuarentena y no puede transicionar.')
 const transitionInput={...input,organizationId,occurredAt,actorId:actor.id,actorName:actor.name,eventId:`${commandId}:workflow`}
 const preview=transitionMirfeReinforcement(record,transition,transitionInput),eventPayload={reinforcementId:aggregateId,siteId:record.siteId,transition,from:record.status,to:preview.status,workflowVersion:preview.workflowVersion,result:text(input.result),summary:`${record.status} → ${preview.status}`}
 const history=createMirfeHistoryEntry({id:`${commandId}:history`,organizationId,siteId:record.siteId,type:MIRFE_HISTORY_TYPES.REINFORCEMENT_TRANSITIONED,eventName:DomainEvents.MIRFE_REINFORCEMENT_TRANSITIONED,entityType:'mirfe.reinforcement',entityId:aggregateId,reinforcementId:aggregateId,occurredAt,actorId:actor.id,summary:`Refuerzo ${record.status} → ${preview.status}`,transition,from:record.status,to:preview.status,evidence:{result:text(input.result),reason:text(input.reason),ecAfter:input.ecAfter??null,phAfter:input.phAfter??null,nextReview:text(input.nextReview)}})
 const apply=current=>mutateIrrigationMirfeState(current,tenant=>{
  const records=list(tenant.mirfeReinforcements),matches=records.filter(item=>item.id===aggregateId)
  if(matches.length!==1)throw new Error('El refuerzo MIRFE cambió antes de confirmar la transición.')
  const currentRecord=matches[0]
  if(Number(currentRecord.workflowVersion||currentRecord.workflow?.version||0)!==expectedVersion||currentRecord.status!==record.status)throw new Error('El workflow MIRFE cambió antes de confirmar la transición.')
  const historyItems=list(tenant.irrigationHistory)
  if(historyItems.some(item=>item.id===history.id))throw new Error('La transición ya existe en el historial MIRFE.')
  const updated=transitionMirfeReinforcement(currentRecord,transition,transitionInput)
  return{...tenant,mirfeReinforcements:records.map(item=>item.id===aggregateId?updated:item),irrigationHistory:[...historyItems,history]}
 })
 return{aggregateType:'mirfe.reinforcement',aggregateId,eventName:DomainEvents.MIRFE_REINFORCEMENT_TRANSITIONED,siteId:record.siteId,eventPayload,collection:'mirfeReinforcements',apply}
}

function planMirfeCorrection(state,input,aggregateId,organizationId,occurredAt,commandId){
 const actor=commandActor(state),reinforcementId=required(input.reinforcementId,'reinforcementId'),record=tenantRecord(state,organizationId,'mirfeReinforcements',reinforcementId,'El refuerzo MIRFE'),expectedVersion=Number(record.workflowVersion||record.workflow?.version||0)
 const correctionInput={...input,id:aggregateId,organizationId,occurredAt,actorId:actor.id,actorName:actor.name,workflowEventId:`${commandId}:workflow`},preview=createMirfeCorrection(correctionInput,record)
 const eventPayload={correctionId:aggregateId,reinforcementId,siteId:record.siteId,from:record.status,to:preview.reinforcement.status,workflowVersion:preview.reinforcement.workflowVersion,action:preview.correction.action,summary:preview.correction.action}
 const history=createMirfeHistoryEntry({id:`${commandId}:history`,organizationId,siteId:record.siteId,type:MIRFE_HISTORY_TYPES.CORRECTION_RECORDED,eventName:DomainEvents.MIRFE_CORRECTION_RECORDED,entityType:'mirfe.correction',entityId:aggregateId,reinforcementId,occurredAt,actorId:actor.id,summary:`Corrección: ${preview.correction.action}`,transition:MIRFE_WORKFLOW_TRANSITIONS.CORRECT,from:record.status,to:preview.reinforcement.status,evidence:{reason:preview.correction.reason,action:preview.correction.action,nextReview:preview.correction.nextReview}})
 const apply=current=>mutateIrrigationMirfeState(current,tenant=>{
  const records=list(tenant.mirfeReinforcements),matches=records.filter(item=>item.id===reinforcementId)
  if(matches.length!==1)throw new Error('El refuerzo MIRFE cambió antes de confirmar la corrección.')
  const currentRecord=matches[0]
  if(Number(currentRecord.workflowVersion||currentRecord.workflow?.version||0)!==expectedVersion||currentRecord.status!==record.status)throw new Error('El workflow MIRFE cambió antes de confirmar la corrección.')
  const corrections=list(tenant.irrigationCorrections),historyItems=list(tenant.irrigationHistory)
  if(corrections.some(item=>item.id===aggregateId)||historyItems.some(item=>item.id===history.id))throw new Error('La corrección ya existe en la empresa activa.')
  const next=createMirfeCorrection(correctionInput,currentRecord)
  return{...tenant,mirfeReinforcements:records.map(item=>item.id===reinforcementId?next.reinforcement:item),irrigationCorrections:[...corrections,next.correction],irrigationHistory:[...historyItems,history]}
 })
 return{aggregateType:'mirfe.correction',aggregateId,eventName:DomainEvents.MIRFE_CORRECTION_RECORDED,siteId:record.siteId,eventPayload,collection:'irrigationCorrections',apply}
}

function buildPlan(state,operation,input,aggregateId,organizationId,occurredAt,commandId){
 if(operation===IRRIGATION_MIRFE_OPERATIONS.CREATE_IRRIGATION_PLAN)return planIrrigation(state,input,aggregateId,organizationId,occurredAt)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.RECORD_WATER_ANALYSIS)return planWaterAnalysis(state,input,aggregateId,organizationId,occurredAt)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.CREATE_NUTRIENT_PRODUCT)return planNutrientProduct(input,aggregateId,organizationId)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.RECORD_NUTRIENT_OBJECTIVE)return planNutrientObjective(input,aggregateId,organizationId,occurredAt)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.CREATE_FORMULATION)return planFormulation(state,input,aggregateId,organizationId,occurredAt,false)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.APPROVE_FORMULATION)return planFormulation(state,input,aggregateId,organizationId,occurredAt,true)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.CREATE_PREPARATION)return planPreparation(state,input,aggregateId,organizationId,occurredAt)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.EXECUTE_PREPARATION)return planExecution(state,input,organizationId,occurredAt,commandId)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.REGISTER_APPLICATION)return planApplication(state,input,aggregateId,organizationId,occurredAt)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.CREATE_MIRFE_PROGRAM)return planMirfeProgram(state,input,aggregateId,organizationId,occurredAt,commandId)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.RECORD_MIRFE_MONITORING)return planMirfeMonitoring(state,input,aggregateId,organizationId,occurredAt,commandId)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.CREATE_MIRFE_REINFORCEMENT)return planMirfeReinforcement(state,input,aggregateId,organizationId,occurredAt,commandId)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.TRANSITION_MIRFE_REINFORCEMENT)return planMirfeTransition(state,input,aggregateId,organizationId,occurredAt,commandId)
 if(operation===IRRIGATION_MIRFE_OPERATIONS.RECORD_MIRFE_CORRECTION)return planMirfeCorrection(state,input,aggregateId,organizationId,occurredAt,commandId)
 throw new Error('Operación Irrigation/MIRFE no soportada.')
}

export async function executeIrrigationMirfeCommand(state,{operation,input={},entityId='',commandId,occurredAt}={},deps={}){
 const normalizedOperation=required(operation,'operation'),normalizedCommandId=required(commandId,'commandId')
 if(!knownOperation(normalizedOperation))throw new Error('Operación Irrigation/MIRFE no soportada.')
 if(!plainObject(input))throw new Error('input debe ser un objeto.')
 const organizationId=activeOrganizationId(state),declaredOwner=explicitOrganizationId(input)
 if(declaredOwner&&declaredOwner!==organizationId)throw new Error('La operación MIRFE declara otra empresa.')
 const scheduledPreparationId=normalizedOperation===IRRIGATION_MIRFE_OPERATIONS.CREATE_PREPARATION&&text(input.loadId)?`${text(input.loadId)}:preparation`:''
 const workflowEntityId=normalizedOperation===IRRIGATION_MIRFE_OPERATIONS.TRANSITION_MIRFE_REINFORCEMENT?text(input.reinforcementId):''
 const provisionalAggregateId=text(scheduledPreparationId||workflowEntityId||entityId||input.id||(normalizedOperation===IRRIGATION_MIRFE_OPERATIONS.EXECUTE_PREPARATION?input.preparationId:normalizedCommandId))
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
