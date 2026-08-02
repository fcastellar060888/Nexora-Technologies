import test from'node:test'
import assert from'node:assert/strict'
import{DEFAULT_SOURCE_PRIORITY,stableFingerprint,sourcePriority,objectVersion,compareProjectionCandidates,preferredProjectionCandidate}from'../src/core/knowledgeGraph/index.js'

const node=({label='Nodo',updatedAt='2026-08-02T10:00:00.000Z',source='passport',version=1,organizationId='org-1'}={})=>({
 nodeId:'org-1:test.node:1',
 organizationId,
 label,
 updatedAt,
 metadata:{source,objectVersion:version}
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

test('compara por fecha, fuente, versión y finalmente huella',()=>{
 assert.equal(compareProjectionCandidates(node({updatedAt:'2026-08-02T11:00:00.000Z'}),node()),1)
 assert.equal(compareProjectionCandidates(node({source:'ledger'}),node({source:'passport'})),1)
 assert.equal(compareProjectionCandidates(node({version:2}),node({version:1})),1)
 const a=node({label:'A'}),b=node({label:'B'})
 assert.equal(compareProjectionCandidates(a,b),-compareProjectionCandidates(b,a))
})

test('selecciona el mismo ganador sin importar el orden de llegada',()=>{
 const weak=node({label:'Passport',source:'passport',version:1})
 const strong=node({label:'Ledger',source:'ledger',version:1})
 assert.deepEqual(preferredProjectionCandidate(weak,strong),strong)
 assert.deepEqual(preferredProjectionCandidate(strong,weak),strong)
})

test('bloquea candidatos de organizaciones diferentes',()=>{
 assert.throws(()=>preferredProjectionCandidate(node(),node({organizationId:'org-2'})),/organizaciones diferentes/)
})
