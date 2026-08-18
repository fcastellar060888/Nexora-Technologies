import{activeOrganizationId,resolveOrganizationId}from'./organizationOwnership.js'
import{canonicalPostharvestLot}from'./production.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()

function ownerOf(state,record,label){
 try{return resolveOrganizationId(state,{record,siteId:record?.siteId,label})}catch{return''}
}
function scopedMany(state,collection,predicate,organizationId,label){
 return list(state?.[collection]).filter(record=>predicate(record)&&ownerOf(state,record,label)===organizationId)
}
function scopedOne(state,collection,id,organizationId,label){
 const identity=text(id)
 if(!identity)return null
 const matches=scopedMany(state,collection,record=>text(record?.id)===identity,organizationId,label)
 if(matches.length>1)throw new Error(`${label} tiene identidad duplicada o ambigua dentro de la empresa activa.`)
 return matches[0]||null
}

export function canonicalPostharvestLotDetail(state,lotId){
 const organizationId=activeOrganizationId(state)
 const lot=canonicalPostharvestLot(state,lotId)
 const units=scopedMany(state,'propagationUnits',unit=>text(unit?.batchId)===text(lot.id),organizationId,'unidad de propagación')
 const mother=scopedOne(state,'motherPlants',lot.motherPlantId,organizationId,'planta madre')
 const grandmother=scopedOne(state,'grandmotherPlants',mother?.grandmotherPlantId,organizationId,'planta abuela')
 const genetic=scopedOne(state,'genetics',lot.geneticId,organizationId,'genética')
 const site=scopedOne(state,'sites',lot.siteId,organizationId,'sede')
 const events=scopedMany(state,'lotEvents',event=>text(event?.lotId)===text(lot.id),organizationId,'evento de lote')
 return{organizationId,lot,units,mother,grandmother,genetic,site,events}
}
