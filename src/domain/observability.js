import{activeOrganizationId}from'./organizationOwnership.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const domainOwner=record=>text(record?.organizationId||record?.companyId||record?.event?.context?.organizationId)
const relationMap={
 siteId:'sites',houseId:'houses',bedId:'beds',plantPositionId:'plantPositions',plantId:'plantPositions',
 areaId:'operationalAreas',assetId:'infrastructureAssets',elementId:'infrastructureElements',batchId:'propagationBatches',
 lotId:'propagationBatches',stockId:'finishedGoods',finishedGoodId:'finishedGoods',productId:'products',inventoryProductId:'products'
}

function referencedOwners(state,collection,id,seen,depth){
 const identity=text(id)
 if(!identity||depth>8)return[]
 const candidates=list(state?.[collection]).filter(record=>text(record?.id||record?.commandId)===identity)
 return[...new Set(candidates.map(record=>resolveObservabilityOwner(state,collection,record,{seen:new Set(seen),depth:depth+1})).filter(Boolean))]
}

export function resolveObservabilityOwner(state,collection,record,{seen=new Set(),depth=0}={}){
 if(!record||typeof record!=='object'||depth>8)return''
 const explicit=domainOwner(record)
 if(explicit)return explicit
 const identity=`${collection}:${text(record.id||record.commandId)||'anonymous'}:${depth}`
 if(seen.has(identity))return''
 seen.add(identity)
 for(const[key,targetCollection]of Object.entries(relationMap)){
  if(!record[key])continue
  const owners=referencedOwners(state,targetCollection,record[key],seen,depth)
  if(owners.length===1)return owners[0]
  if(owners.length>1)return''
 }
 const companies=list(state?.companies)
 if(companies.length===1)return text(companies[0]?.id)
 if(companies.length===0)return'local-installation'
 return''
}

function scoped(state,collection,organizationId){
 return list(state?.[collection]).flatMap(record=>resolveObservabilityOwner(state,collection,record)===organizationId?[record.organizationId?record:{...record,organizationId}]:[])
}

const OBSERVABILITY_COLLECTIONS=[
 'sites','houses','beds','plantPositions','auditLog','mirfeMonitoring','findings','motherPlants','propagationBatches','propagationUnits','phaseTransitions','cultivationCycles','operationalAreas','infrastructureElements','infrastructureAssets','assetMaintenances','environmentalReadings','genetics','incidents','treatments','products','inventoryLots','inventoryMovements','finishedGoods','finishedGoodsMovements','sales','waterAnalyses','nutrientObjectives','formulations','tankPreparations','workOrders','irrigationApplications','productionFlows','costEntries'
]

export function observabilityViewForActiveOrganization(state){
 const organizationId=activeOrganizationId(state)
 const view={organizationId}
 for(const collection of OBSERVABILITY_COLLECTIONS)view[collection]=scoped(state,collection,organizationId)
 return view
}

export function diagnosticStateForActiveOrganization(state){
 const view=observabilityViewForActiveOrganization(state)
 const organizationId=view.organizationId
 const company=list(state?.companies).find(item=>text(item?.id)===organizationId)
 return{
  ...state,
  ...Object.fromEntries(OBSERVABILITY_COLLECTIONS.map(collection=>[collection,view[collection]])),
  companies:company?[company]:[],
  currentContext:{...(state?.currentContext||{}),companyId:organizationId}
 }
}
