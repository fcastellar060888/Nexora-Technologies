import{createIntelligentObject}from'./passportContract.js'
import{createPassportBuilder}from'./passportBuilder.js'
import{createProjectionPlugin}from'./passportProjectionPlugin.js'
import{composePassportTimeline}from'./passportTimeline.js'

const text=(value,fallback='')=>{const normalized=String(value??'').trim();return normalized||fallback}
const list=value=>Array.isArray(value)?value:[]
const validDate=value=>!Number.isNaN(Date.parse(value))
const date=value=>validDate(value)?new Date(value).toISOString():null
const openFinding=finding=>!['Resuelto','Falso positivo'].includes(finding?.status)

const cultivationPlantPassportBuilder=createPassportBuilder({plugins:[createProjectionPlugin({id:'cultivation.plant.projection'})]})

function locationFor(state,plant){
 const bed=list(state?.beds).find(item=>item.id===plant?.bedId)||null
 const house=list(state?.houses).find(item=>item.id===bed?.houseId)||null
 const site=list(state?.sites).find(item=>item.id===house?.siteId)||null
 const company=list(state?.companies).find(item=>item.id===site?.companyId)||null
 return{bed,house,site,company}
}

function lineageFor(state,plantId){
 const unit=list(state?.propagationUnits).find(item=>item.plantPositionId===plantId)||null
 const batch=list(state?.propagationBatches).find(item=>item.id===unit?.batchId)||null
 const mother=list(state?.motherPlants).find(item=>item.id===batch?.motherPlantId)||null
 const grandmother=list(state?.grandmotherPlants).find(item=>item.id===mother?.grandmotherPlantId)||null
 return{unit,batch,mother,grandmother}
}

function documentsFor(state,plantId){
 return list(state?.attachments)
  .filter(item=>item.entityType==='plant'&&item.entityId===plantId)
  .map(item=>Object.freeze({id:text(item.id),type:text(item.type,'application/octet-stream'),name:text(item.name,'Adjunto'),size:Number(item.size)||0,dataUrl:item.dataUrl||'',createdAt:date(item.createdAt)}))
}

function timelineFor(state,plantId,findings){
 const findingIds=new Set(findings.map(item=>item.id))
 const incidentById=new Map(list(state?.incidents).map(item=>[item.id,item]))
 const productById=new Map(list(state?.products).map(item=>[item.id,item]))
 const events=list(state?.plantEvents).filter(item=>item.plantId===plantId).map(item=>({id:`plant:${text(item.id)}`,sourceId:text(item.id),occurredAt:date(item.date||item.createdAt),type:text(item.type,'Observación'),title:text(item.title,'Evento de planta'),summary:text(item.detail),status:text(item.status)}))
 const findingEvents=findings.map(item=>({id:`mipe:${text(item.id)}`,sourceId:text(item.id),occurredAt:date(item.createdAt||item.updatedAt),type:'MIPE',title:text(incidentById.get(item.incidentId)?.name,'Hallazgo MIPE'),summary:text(item.notes||item.observation||`Severidad ${item.severity??'—'}`),status:text(item.status)}))
 const treatmentEvents=list(state?.treatments).filter(item=>findingIds.has(item.findingId)).map(item=>({id:`treatment:${text(item.id)}`,sourceId:text(item.id),occurredAt:date(item.executedAt||item.date||item.createdAt),type:'Tratamiento',title:text(productById.get(item.productId)?.name,'Tratamiento MIPE'),summary:text(item.executionNotes||item.notes||`${item.totalQuantity||0} ${item.inventoryUnit||''}`),status:text(item.status)}))
 return composePassportTimeline({canonical:state?.timelineEntries,legacy:[...events,...findingEvents,...treatmentEvents],aggregateId:plantId})
}

function relationshipsFor({bed,house,site},lineage){
 const relationships=[]
 if(bed)relationships.push({type:'located_in',targetType:'cultivation.bed',targetId:bed.id,label:bed.name||bed.id})
 if(house)relationships.push({type:'located_in',targetType:'cultivation.house',targetId:house.id,label:house.name||house.id})
 if(site)relationships.push({type:'located_in',targetType:'organization.site',targetId:site.id,label:site.name||site.id})
 if(lineage.batch)relationships.push({type:'member_of_lot',targetType:'cultivation.lot',targetId:lineage.batch.id,label:lineage.batch.code||lineage.batch.id})
 if(lineage.unit)relationships.push({type:'originated_from',targetType:'propagation.unit',targetId:lineage.unit.id,label:lineage.unit.code||lineage.unit.id})
 if(lineage.mother)relationships.push({type:'descends_from',targetType:'cultivation.mother',targetId:lineage.mother.id,label:lineage.mother.lotCode||lineage.mother.id})
 if(lineage.grandmother)relationships.push({type:'descends_from',targetType:'cultivation.grandmother',targetId:lineage.grandmother.id,label:lineage.grandmother.lotCode||lineage.grandmother.id})
 return relationships
}

export function createCultivationPlantPassportFromState(state,{plantId,actions=[],decisionContext={}}={}){
 const id=text(plantId)
 const plant=list(state?.plantPositions).find(item=>item.id===id)
 if(!plant)throw new Error('No se encontró la planta productiva solicitada')
 const location=locationFor(state,plant)
 const lineage=lineageFor(state,id)
 const findings=list(state?.findings).filter(item=>item.plantPositionId===id)
 const activeFindings=findings.filter(openFinding)
 const genetic=list(state?.genetics).find(item=>item.id===(plant.geneticId||location.bed?.geneticId||lineage.batch?.geneticId))||null
 const organizationId=text(location.site?.companyId||plant.companyId||plant.organizationId)||'local-installation'
 const createdAt=date(plant.createdAt||lineage.unit?.cutDate||lineage.batch?.createdAt)||new Date().toISOString()
 const label=text(plant.code||plant.plantCode)||`${text(location.site?.name,'SED').slice(0,3).toUpperCase()}-${text(location.house?.name,'N')}-${text(location.bed?.name,'C')}-F${plant.row||0}-P${plant.position||0}`.replaceAll(' ','')
 const object=createIntelligentObject({objectType:'cultivation.plant',objectId:id,organizationId,siteId:location.site?.id||null,label,status:text(plant.status,plant.active===false?'inactive':'active'),createdAt,updatedAt:date(plant.updatedAt)||createdAt,identity:{code:label,row:plant.row??null,position:plant.position??null,bedId:plant.bedId||null},attributes:{active:plant.active!==false,geneticId:genetic?.id||null,geneticName:genetic?.name||'',phase:lineage.batch?.phase||'',lotId:lineage.batch?.id||null,healthStatus:plant.healthStatus||''},metadata:{compatibilityMode:'existing-plant-position-v1',sourceCollection:'plantPositions'}})
 const risks=activeFindings.map(item=>({id:item.id,type:'mipe.finding',severity:item.severity??null,status:item.status||'',label:incidentLabel(state,item)}))
 const projection={relationships:relationshipsFor(location,lineage),documents:documentsFor(state,id),indicators:[{key:'open_mipe_findings',value:activeFindings.length,unit:'findings'},{key:'total_mipe_findings',value:findings.length,unit:'findings'}],risks,actions,timeline:timelineFor(state,id,findings),decisionContext}
 return cultivationPlantPassportBuilder.build({object,state,context:{projection}})
}

function incidentLabel(state,finding){return list(state?.incidents).find(item=>item.id===finding.incidentId)?.name||finding.type||finding.pest||'Hallazgo MIPE'}
