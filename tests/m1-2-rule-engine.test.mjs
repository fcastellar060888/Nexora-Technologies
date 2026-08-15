import test from'node:test'
import assert from'node:assert/strict'
import{defineRuleSet,evaluateRuleSet,explainRuleDecision}from'../src/domain/ruleEngine.js'
import{DEFAULT_PHASE_DAYS,phaseTargetDecision,targetDays}from'../src/domain/lifecycle.js'

test('M12-F006: rules resolve by priority then specificity then stable rule id',()=>{
 const rules=defineRuleSet({id:'phase-days',defaultValue:10,rules:[
  {id:'z-general',value:20,priority:100,conditions:{phase:'Floración'}},
  {id:'b-genetic',value:30,priority:100,conditions:{phase:'Floración',geneticId:'g1'}},
  {id:'a-genetic',value:31,priority:100,conditions:{phase:'Floración',geneticId:'g1'}},
  {id:'disabled',value:99,priority:999,active:false,conditions:{phase:'Floración',geneticId:'g1'}}
 ]})
 const decision=evaluateRuleSet(rules,{phase:'Floración',geneticId:'g1'})
 assert.equal(decision.value,31)
 assert.equal(decision.ruleId,'a-genetic')
 assert.deepEqual(decision.matchedRuleIds,['a-genetic','b-genetic','z-general'])
})

test('M12-F006: default is explicit and decision remains explainable',()=>{
 const rules=defineRuleSet({id:'fallback',defaultValue:14,rules:[{id:'other',value:5,conditions:{stage:'x'}}]})
 const decision=explainRuleDecision(rules,{stage:'y',organizationId:'org-a'})
 assert.equal(decision.source,'default')
 assert.equal(decision.ruleId,null)
 assert.equal(decision.value,14)
 assert.deepEqual(decision.context,{stage:'y',organizationId:'org-a'})
})

test('M12-F006: lifecycle precedence is lot override then genetic then general then domain default',()=>{
 const state={phaseTargets:[
  {id:'general',phase:'Floración',days:70,active:true},
  {id:'genetic',phase:'Floración',geneticId:'g1',days:65,active:true},
  {id:'inactive',phase:'Floración',geneticId:'g1',days:1,active:false}
 ]}
 const lot={id:'lot-1',phase:'Floración',geneticId:'g1'}
 assert.equal(targetDays(state,lot),65)
 assert.equal(phaseTargetDecision(state,lot).ruleId,'genetic')
 assert.equal(targetDays(state,{...lot,geneticId:'g2'}),70)
 assert.equal(targetDays({phaseTargets:[]},lot),DEFAULT_PHASE_DAYS.Floración)
 assert.equal(targetDays(state,{...lot,phaseTargetDays:55}),55)
 assert.match(phaseTargetDecision(state,{...lot,phaseTargetDays:55}).ruleId,/^lot:/)
})

test('M12-F006: invalid target values cannot silently outrank valid business rules',()=>{
 const state={phaseTargets:[
  {id:'invalid-specific',phase:'Vegetativo',geneticId:'g1',days:'not-a-number',active:true},
  {id:'general',phase:'Vegetativo',days:24,active:true}
 ]}
 const decision=phaseTargetDecision(state,{id:'lot-1',phase:'Vegetativo',geneticId:'g1'})
 assert.equal(decision.value,24)
 assert.equal(decision.ruleId,'general')
})

test('M12-F006 re-audit: duplicate rule ids fail closed',()=>{
 assert.throws(()=>defineRuleSet({id:'dup',defaultValue:0,rules:[{id:'same',value:1},{id:'same',value:2}]}),/Regla duplicada/)
})
