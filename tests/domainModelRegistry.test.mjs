import test from'node:test'
import assert from'node:assert/strict'
import{CANONICAL_EVENTS,DATA_SOURCES,DOMAIN_ENGINES,IMPLEMENTATION_PRIORITY,NEXORA_DOMAIN_MODEL_VERSION,findEntityOwner,getDomainEngine,isCanonicalDataSource,isCanonicalEvent}from'../src/domain/domainModelRegistry.js'

test('declara una versión estable y todos los motores estratégicos',()=>{
 assert.equal(NEXORA_DOMAIN_MODEL_VERSION,'1.0.0')
 for(const id of['FACILITY','PLANT','GROWING_MEDIUM','IRRIGATION','MIPE','ENVIRONMENT','BIOMASS','QUALITY','INVENTORY','KNOWLEDGE','INTELLIGENCE'])assert.ok(DOMAIN_ENGINES[id])
})

test('cada entidad canónica tiene un motor propietario',()=>{
 assert.equal(findEntityOwner('PlantIdentity').id,'PLANT')
 assert.equal(findEntityOwner('FacilitySpace').id,'FACILITY')
 assert.equal(findEntityOwner('AnalysisResult').id,'QUALITY')
 assert.equal(findEntityOwner('BiomassMovement').id,'BIOMASS')
 assert.equal(findEntityOwner('EnvironmentalReading').id,'ENVIRONMENT')
 assert.equal(findEntityOwner('UnknownEntity'),null)
})

test('valida fuentes y eventos canónicos',()=>{
 for(const source of Object.values(DATA_SOURCES))assert.equal(isCanonicalDataSource(source),true)
 assert.equal(isCanonicalDataSource('ESTIMATED'),false)
 for(const eventName of CANONICAL_EVENTS)assert.equal(isCanonicalEvent(eventName),true)
 assert.equal(isCanonicalEvent('pantalla.boton.click'),false)
})

test('la prioridad de implementación empieza por infraestructura y planta',()=>{
 assert.deepEqual(IMPLEMENTATION_PRIORITY.slice(0,3),['FACILITY','PLANT','GROWING_MEDIUM'])
 assert.equal(getDomainEngine('quality').label,'Quality & Compliance Engine')
 assert.throws(()=>getDomainEngine('unknown'),/Motor de dominio desconocido/)
})
