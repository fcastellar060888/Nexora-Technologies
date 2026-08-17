import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('F009: PhaseTransitions usa command boundary y no muta fases directamente desde UI',async()=>{
 const source=await read('src/pages/PhaseTransitionsPage.jsx')
 assert.match(source,/executePlantPhaseTransitionCommand/)
 assert.doesNotMatch(source,/phaseTransitions:\s*\[\.\.\.state\.phaseTransitions/)
 assert.doesNotMatch(source,/plantPositions:\s*state\.plantPositions\.map/)
})

test('F009: propagation command aplica guard MIPE dentro del executor y usa un solo reloj',async()=>{
 const source=await read('src/services/propagationBatchCommand.js')
 assert.match(source,/propagationSourceUnits\(state,\{organizationId,siteId,at:occurredAt\}\)/)
 assert.match(source,/assertMipeOperationAllowed/)
 assert.match(source,/MIPE_RESTRICTED_OPERATIONS\.PROPAGATION_CUT/)
 assert.match(source,/at:occurredAt/)
})

test('F009: activePlantRestrictions delega a la autoridad canónica tenant-aware',async()=>{
 const source=await read('src/domain/mipe.js')
 assert.match(source,/projectMipeOperationalRestrictions/)
 assert.match(source,/organizationId:activeOrganizationId\(state\)/)
})

test('F009: cambio de fase vegetal publica evento canónico plant-specific',async()=>{
 const catalog=await read('src/core/events/eventCatalog.js')
 const command=await read('src/services/plantPhaseTransitionCommand.js')
 assert.match(catalog,/PLANT_PHASE_CHANGED:'cultivation\.plant\.phase_changed'/)
 assert.match(command,/completedEventName:DomainEvents\.PLANT_PHASE_CHANGED/)
})

test('F009: selector de propagación no confía ciegamente en Bloqueada por MIPE legacy',async()=>{
 const source=await read('src/domain/propagationPurpose.js')
 assert.match(source,/historicalPropagationBlock/)
 assert.match(source,/blockersForMipeOperation/)
 assert.match(source,/legacyMipeBlockedAvailability/)
})
