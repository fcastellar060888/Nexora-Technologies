import test from'node:test'
import assert from'node:assert/strict'
import{DEFAULT_SOURCE_PRIORITY,stableFingerprint,sourcePriority,objectVersion,compareProjectionCandidates,preferredProjectionCandidate}from'../src/core/knowledgeGraph/index.js'

const node=({label='Nodo',updatedAt='2026-08-02T10:00:00.000Z',source='passport',version=1,organizationId='org-1',metadata={}}={})=>({
 nodeId:'org-1:test.node:1',
 organizationId,
 label,
 updatedAt,
 metadata:{source,objectVersion:version,...metadata}
})

test('expone prioridades de fuente inmutables y aplica fallback',()=>{
 assert.equal(DEFAULT_SOURCE_PRIORITY.ledger>DEFAULT_SOURCE_PRIORITY.passport,true)
 assert.equal(Object.isFrozen(DEFAULT_SOURCE_PRIORITY),true)
 assert.equal(sourcePriority(node({source:'ledger'})),600)
 assert.equal(sourcePriority(node({source:'desconocida'})),100)
})

test('normaliza versiones numéricas y descarta valores inválidos',()=>{
 assert.equal(objectVersion(node({version:'7'})),7)
 assert.equal(objectVersion(node({version:'no-numérica'})),0)
})

test('la huella estable no depende del orden de las propiedades',()=>{
 const left={b:2,a:{d:4,c:3}},right={a:{c:3,d:4},b:2}
 assert.equal(stableFingerprint(left),stableFingerprint(right))
})

test('compara por autoridad, versión, tiempo y finalmente huella',()=>{
 const authoritativeOld=node({source:'ledger',updatedAt:'2026-01-01T00:00:00.000Z'})
 const weakFuture=node({source:'passport',updatedAt:'2099-01-01T00:00:00.000Z'})
 assert.equal(compareProjectionCandidates(authoritativeOld,weakFuture),1)
 assert.equal(compareProjectionCandidates(node({source:'passport',version:2}),node({source:'passport',version:1,updatedAt:'2099-01-01T00:00:00.000Z'})),1)
 assert.equal(compareProjectionCandidates(node({source:'passport',version:1,updatedAt:'2026-08-02T11:00:00.000Z'}),node({source:'passport',version:1})),1)
 const a=node({label:'A'}),b=node({label:'B'})
 assert.equal(compareProjectionCandidates(a,b),-compareProjectionCandidates(b,a))
})

test('recordedAt autoritativo desempata antes de updatedAt cuando la autoridad y versión coinciden',()=>{
 const newerRecorded=node({updatedAt:'2026-01-01T00:00:00.000Z',metadata:{recordedAt:'2026-08-03T10:00:00.000Z'}})
 const newerUpdated=node({updatedAt:'2026-08-04T00:00:00.000Z',metadata:{recordedAt:'2026-08-03T09:00:00.000Z'}})
 assert.equal(compareProjectionCandidates(newerRecorded,newerUpdated),1)
})

test('selecciona el mismo ganador sin importar el orden de llegada',()=>{
 const weak=node({label:'Passport futuro',source:'passport',version:99,updatedAt:'2099-01-01T00:00:00.000Z'})
 const strong=node({label:'Ledger histórico',source:'ledger',version:1,updatedAt:'2020-01-01T00:00:00.000Z'})
 assert.deepEqual(preferredProjectionCandidate(weak,strong),strong)
 assert.deepEqual(preferredProjectionCandidate(strong,weak),strong)
})

test('bloquea candidatos de organizaciones diferentes',()=>{
 assert.throws(()=>preferredProjectionCandidate(node(),node({organizationId:'org-2'})),/organizaciones diferentes/)
})
