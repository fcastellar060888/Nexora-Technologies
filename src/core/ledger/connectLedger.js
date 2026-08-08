export function connectLedgerToEventBus(ledger,bus,{onAppend=null}={}){
 if(!ledger?.append)throw new Error('El repositorio del Ledger no es válido')
 if(!bus?.subscribe)throw new Error('El Event Bus no es válido')
 if(onAppend!==null&&typeof onAppend!=='function')throw new Error('onAppend debe ser una función')
 return bus.subscribe('*',event=>{
  const entry=ledger.append(event)
  if(onAppend)onAppend(entry,event)
  return entry
 })
}
