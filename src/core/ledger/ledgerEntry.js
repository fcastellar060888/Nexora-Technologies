import{isDomainEvent}from'../events/index.js'

export function createLedgerEntry(event,{sequence=0,recordedAt=new Date().toISOString()}={}){
 if(!isDomainEvent(event))throw new Error('El Operational Ledger requiere un evento de dominio válido')
 if(!Number.isInteger(sequence)||sequence<0)throw new Error('La secuencia del Ledger debe ser un entero no negativo')
 if(Number.isNaN(Date.parse(recordedAt)))throw new Error('La fecha de registro del Ledger no es válida')
 return Object.freeze({
  id:event.eventId,
  sequence,
  recordedAt:new Date(recordedAt).toISOString(),
  event
 })
}

export function isLedgerEntry(value){
 return Boolean(value&&value.id&&Number.isInteger(value.sequence)&&value.sequence>=0&&!Number.isNaN(Date.parse(value.recordedAt))&&isDomainEvent(value.event)&&value.id===value.event.eventId)
}
