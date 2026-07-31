export const RECORD_LOCK_TTL_MS=45000

export function recordKey({path='',formId='',recordId=''}){
 return [path,formId||'form',recordId||'new'].join('::')
}

export function activeLocks(items=[],now=Date.now()){
 return items.filter(item=>item?.actorId&&now-new Date(item.updatedAt||item.emittedAt||0).getTime()<RECORD_LOCK_TTL_MS)
}

export function lockForDescriptor(items=[],descriptor={},actorId='',now=Date.now()){
 const key=recordKey(descriptor)
 return activeLocks(items,now).find(item=>item.actorId!==actorId&&recordKey(item)===key)||null
}

export function descriptorFromElement(target){
 const form=target?.closest?.('form')
 const container=target?.closest?.('[data-record-id],[data-record-key],[role="dialog"],.modal')
 const heading=(container||form||document)?.querySelector?.('h1,h2,h3,h4,.card-heading strong,.modal-head strong')?.textContent?.trim()
 return{
  path:window.location.pathname,
  formId:form?.id||form?.dataset?.formId||'',
  recordId:container?.dataset?.recordId||container?.dataset?.recordKey||form?.dataset?.recordId||'',
  label:form?.dataset?.module||heading||document.title||'Formulario'
 }
}
