import{passportSourceValue}from'./passportSources.js'

const{list,iso}=passportSourceValue
const CLOSED_FINDING_STATUSES=new Set(['Resuelto','Falso positivo','Planta eliminada'])

export const isOpenPassportFinding=item=>!CLOSED_FINDING_STATUSES.has(item?.status)

export function projectPassportFindings({findings=[],matches,map}={}){
 if(typeof matches!=='function')throw new Error('La proyección MIPE requiere un predicado matches')
 if(map!==undefined&&typeof map!=='function')throw new Error('La proyección MIPE requiere un mapper válido')
 return Object.freeze(list(findings).filter(matches).map(item=>Object.freeze(map?map(item):{
  id:item.id,
  type:item.type||item.pest||'Hallazgo MIPE',
  status:item.status||'Abierto',
  severity:item.severity??'—',
  notes:item.notes||item.observation||'',
  reportedAt:iso(item.reportedAt||item.reportDate||item.createdAt||item.updatedAt)
 })))
}

export function passportIndicator(key,value,unit,extra={}){
 const normalizedKey=String(key||'').trim()
 if(!normalizedKey)throw new Error('El indicador requiere una clave')
 return Object.freeze({key:normalizedKey,value,unit:String(unit||'').trim(),...extra})
}

export function passportRelationship(type,targetType,targetId,label,{targetOrganizationId,...extra}={}){
 const normalizedType=String(type||'').trim(),normalizedTargetType=String(targetType||'').trim(),normalizedTargetId=String(targetId||'').trim(),normalizedOrganizationId=String(targetOrganizationId||'').trim()
 if(!normalizedType||!normalizedTargetType||!normalizedTargetId)throw new Error('La relación requiere tipo, tipo de destino e identificador')
 if(!normalizedOrganizationId)throw new Error('La relación requiere la empresa explícita del destino')
 return Object.freeze({type:normalizedType,targetType:normalizedTargetType,targetId:normalizedTargetId,targetOrganizationId:normalizedOrganizationId,label:label||normalizedTargetId,...extra})
}
