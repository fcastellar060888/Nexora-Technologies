import{composePassportTimeline}from'./passportTimeline.js'

const list=value=>Array.isArray(value)?value:[]
const text=(value,fallback='')=>{const normalized=String(value??'').trim();return normalized||fallback}
const iso=value=>Number.isNaN(Date.parse(value))?null:new Date(value).toISOString()

export function projectPassportDocuments({attachments=[],matches,nameFallback='Adjunto'}={}){
 if(typeof matches!=='function')throw new Error('La proyección documental requiere una función matches')
 return list(attachments).filter(matches).map(item=>Object.freeze({
  id:text(item.id),
  type:text(item.type,'application/octet-stream'),
  name:text(item.name,nameFallback),
  size:Number(item.size)||0,
  dataUrl:item.dataUrl||'',
  createdAt:iso(item.createdAt)
 }))
}

export function projectPassportTimeline({canonical=[],legacy=[],aggregateId}={}){
 const id=text(aggregateId)
 if(!id)throw new Error('La proyección del Timeline requiere aggregateId')
 return composePassportTimeline({canonical:list(canonical),legacy:list(legacy),aggregateId:id})
}

export const passportSourceValue=Object.freeze({list,text,iso})
