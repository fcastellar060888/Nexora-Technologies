export const CURRENT_SCHEMA_VERSION=7

const arrays=['companies','farms','sites','houses','beds','plantPositions','operationalAreas','infrastructureElements','infrastructureMovements','infrastructureAssets','assetMaintenances','environmentalReadings','genetics','incidents','findings','treatments','attachments','plantEvents','grandmotherPlants','motherPlants','propagationBatches','propagationUnits','phaseTransitions','cultivationCycles','phaseTargets','lotEvents','cultivationTasks','propagationBanks','mapElements','products','inventoryLots','inventoryMovements','finishedGoods','finishedGoodsMovements','sales','customers','currencies','mirfePrograms','mirfeMonitoring','mirfeReinforcements','waterAnalyses','nutrientProducts','nutrientObjectives','irrigationPlans','formulations','tankPreparations','workOrders','irrigationApplications','irrigationCorrections','irrigationHistory','productionBatches','dryingBatches','trimmingBatches','selectionBatches','packingBatches','productionFlows','costEntries','users','roles','memberships','userSessions','auditLog','syncQueue','syncConflicts','syncHealthEvents','syncDeviceHealth']

const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback
const nullableNumber=value=>value===''||value==null?null:number(value)
const list=value=>Array.isArray(value)?value:[]
const unique=value=>[...new Set(list(value).filter(Boolean))]

function normalizeFinishedGood(item){
 const available=Math.max(0,number(item.availableGrams))
 const reserved=Math.max(0,number(item.reservedGrams))
 const sold=Math.max(0,number(item.soldGrams))
 const initial=Math.max(available+reserved+sold,number(item.initialGrams,available+reserved+sold))
 return{...item,initialGrams:initial,availableGrams:available,reservedGrams:reserved,soldGrams:sold}
}

function normalizeSale(item){
 const grams=Math.max(0,number(item.grams))
 const pricePerGram=Math.max(0,number(item.pricePerGram))
 const exchangeRate=number(item.exchangeRate,1)||1
 const totalOriginal=number(item.totalOriginal,grams*pricePerGram)
 const totalBase=number(item.totalBase,totalOriginal*exchangeRate)
 return{...item,grams,pricePerGram,exchangeRate,totalOriginal,totalBase,status:item.status||'Despachada'}
}

function flattenPreparationItems(preparation,formulations,nutrientProducts){
 if(Array.isArray(preparation.items))return preparation.items.map((item,index)=>({id:item.id||`${preparation.id}-${index}`,requiredUnit:'g',lotId:'',consumedQuantity:0,cost:0,...item,requiredQuantity:number(item.requiredQuantity??item.grams)}))
 const formulation=formulations.find(x=>x.id===preparation.formulationId)
 const source=formulation?.items||Object.entries(preparation.tanks||{}).flatMap(([tank,items])=>list(items).map(item=>({...item,tank})))
 return source.map((item,index)=>({id:item.id||`${preparation.id}-${index}`,nutrientProductId:item.nutrientProductId||item.productId,tank:item.tank||'A',requiredQuantity:number(item.requiredQuantity??item.grams),requiredUnit:'g',inventoryProductId:item.inventoryProductId||nutrientProducts.find(x=>x.id===(item.nutrientProductId||item.productId))?.inventoryProductId||'',lotId:item.lotId||'',consumedQuantity:number(item.consumedQuantity),cost:number(item.cost)}))
}

function normalizeMembership(item){
 return{...item,companyId:item.companyId||item.organizationId||'',siteIds:unique(item.siteIds),permissionOverrides:unique(item.permissionOverrides),deniedPermissions:unique(item.deniedPermissions),status:item.status||'active'}
}

function normalizeQueue(item){
 return{...item,baseVersion:Math.max(0,number(item.baseVersion)),attempts:Math.max(0,number(item.attempts)),status:item.status||'pending',error:item.error||''}
}

export function migrateState(input={}){
 const state={...input}
 for(const key of arrays)state[key]=list(state[key])
 state.currentContext={companyId:'',siteId:'',houseId:'',bedId:'',plantId:'',geneticId:'',stage:'',week:1,cycleId:'',...(state.currentContext||{})}
 state.propagationBatches=state.propagationBatches.map(x=>({...x,productionLedger:list(x.productionLedger),activeQuantity:Math.max(0,number(x.activeQuantity??x.quantity))}))
 state.finishedGoods=state.finishedGoods.map(normalizeFinishedGood)
 state.sales=state.sales.map(normalizeSale)
 state.nutrientProducts=state.nutrientProducts.map(x=>({...x,inventoryProductId:x.inventoryProductId||''}))
 state.treatments=state.treatments.map(x=>({...x,status:x.status||'Programado',executedAt:x.executedAt||'',inventoryLotId:x.inventoryLotId||'',totalCost:number(x.totalCost),reentryUntil:x.reentryUntil||'',harvestRestrictedUntil:x.harvestRestrictedUntil||''}))
 state.tankPreparations=state.tankPreparations.map(x=>({...x,status:x.status||'Pendiente',items:flattenPreparationItems(x,state.formulations,state.nutrientProducts),totalCost:number(x.totalCost)}))
 state.inventoryLots=state.inventoryLots.map(x=>({...x,quantity:Math.max(0,number(x.quantity))}))
 state.infrastructureAssets=state.infrastructureAssets.map(x=>({...x,status:x.status||'Operativo',cost:nullableNumber(x.cost),usefulLifeYears:nullableNumber(x.usefulLifeYears)}))
 state.assetMaintenances=state.assetMaintenances.map(x=>({...x,status:x.status||'Programado',type:x.type||'Preventivo',cost:Math.max(0,number(x.cost)),hours:nullableNumber(x.hours)}))
 state.environmentalReadings=state.environmentalReadings.map(x=>({...x,temperature:number(x.temperature),humidity:number(x.humidity),co2:nullableNumber(x.co2),targetTempMin:nullableNumber(x.targetTempMin),targetTempMax:nullableNumber(x.targetTempMax),targetHumidityMin:nullableNumber(x.targetHumidityMin),targetHumidityMax:nullableNumber(x.targetHumidityMax)}))
 state.roles=state.roles.map(x=>({...x,permissions:unique(x.permissions),active:x.active!==false}))
 state.memberships=state.memberships.map(normalizeMembership)
 state.userSessions=state.userSessions.map(x=>({...x,status:x.status||'active',lastSeenAt:x.lastSeenAt||x.createdAt||''}))
 state.syncQueue=state.syncQueue.map(normalizeQueue)
 state.syncConflicts=state.syncConflicts.map(x=>({...x,status:x.status||'open',createdAt:x.createdAt||new Date().toISOString()}))
 state.syncHealthEvents=state.syncHealthEvents.map(x=>({...x,status:x.status||'success',createdAt:x.createdAt||new Date().toISOString(),durationMs:Math.max(0,number(x.durationMs))})).slice(-500)
 state.syncDeviceHealth=state.syncDeviceHealth.map(x=>({...x,totalAttempts:Math.max(0,number(x.totalAttempts)),totalSuccesses:Math.max(0,number(x.totalSuccesses)),totalFailures:Math.max(0,number(x.totalFailures)),consecutiveFailures:Math.max(0,number(x.consecutiveFailures))}))
 state.syncMeta={lastSyncedAt:'',cursorByCompany:{},...(state.syncMeta||{})}
 state.schemaVersion=CURRENT_SCHEMA_VERSION
 return state
}
