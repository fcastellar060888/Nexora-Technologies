export function connectLedgerToEventBus(ledger,bus){
 if(!ledger?.append)throw new Error('El repositorio del Ledger no es válido')
 if(!bus?.subscribe)throw new Error('El Event Bus no es válido')
 return bus.subscribe('*',event=>ledger.append(event))
}
