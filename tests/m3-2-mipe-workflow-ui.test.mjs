import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const read=path=>readFile(path,'utf8')

test('M32-F005: Findings UI exposes corrections and legal transitions instead of history rewrite controls',async()=>{
 const source=await read('src/pages/FindingsPage.jsx')
 assert.match(source,/CORRECT_FINDING/)
 assert.match(source,/TRANSITION_FINDING/)
 assert.match(source,/availableMipeFindingTransitions/)
 assert.match(source,/Motivo de la corrección/)
 assert.match(source,/Corrección auditable del hallazgo/)
 assert.match(source,/Fecha original/)
 assert.match(source,/disabled/)
 assert.doesNotMatch(source,/DateTimeFields/)
 assert.doesNotMatch(source,/DELETE_FINDING/)
 assert.doesNotMatch(source,/>Eliminar</)
 assert.doesNotMatch(source,/operation:MIPE_OPERATIONS\.UPDATE_FINDING/)
})

test('M32-F005: map cannot choose an arbitrary initial finding state',async()=>{
 const source=await read('src/pages/HouseMapPage.jsx')
 assert.match(source,/Estado inicial/)
 assert.match(source,/value="Detectado" disabled/)
 assert.doesNotMatch(source,/findingStatuses/)
 assert.doesNotMatch(source,/status:e\.target\.value/)
 assert.match(source,/MIPE_OPERATIONS\.CREATE_FINDING/)
})

test('M32-F005: command boundary rejects hard-delete and routes corrections/transitions semantically',async()=>{
 const source=await read('src/services/mipeCommand.js')
 assert.match(source,/hard-delete de hallazgos MIPE está prohibido/)
 assert.match(source,/MIPE_FINDING_CORRECTED/)
 assert.match(source,/MIPE_FINDING_TRANSITIONED/)
 assert.match(source,/correctMipeFinding/)
 assert.match(source,/transitionMipeFinding/)
 assert.match(source,/createMipeFindingWorkflow/)
})

test('M32-F005: treatment lifecycle appends finding transitions without expanding the F004 atomic collection set',async()=>{
 const command=await read('src/services/mipeCommand.js')
 const transaction=await read('src/services/mipeTreatmentTransaction.js')
 assert.match(command,/APPROVE_TREATMENT/)
 assert.match(command,/BEGIN_TREATMENT/)
 assert.match(command,/START_FOLLOW_UP/)
 assert.match(transaction,/\['inventoryLots','inventoryMovements','treatments','findings','costEntries'\]/)
})
