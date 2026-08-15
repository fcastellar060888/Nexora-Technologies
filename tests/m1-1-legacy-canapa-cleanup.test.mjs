import test from'node:test'
import assert from'node:assert/strict'
import{cleanupLegacySeed}from'../src/services/legacySeedCleanup.js'

test('removes unused legacy Canapa/Cannapa seed companies',()=>{
 const state={companies:[{id:'legacy',name:'Cannapa SAS'},{id:'real',name:'Empresa Real'}],sites:[],currentContext:{companyId:'legacy'}}
 const next=cleanupLegacySeed(state)
 assert.deepEqual(next.companies,[{id:'real',name:'Empresa Real'}])
 assert.equal(next.currentContext.companyId,'')
})

test('does not remove a legacy-named company if it already owns sites',()=>{
 const state={companies:[{id:'legacy',name:'Cannapa SAS'}],sites:[{id:'site-1',companyId:'legacy'}],currentContext:{companyId:'legacy'}}
 assert.equal(cleanupLegacySeed(state),state)
})
