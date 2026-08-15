const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]
const primitive=value=>value===null||['string','number','boolean'].includes(typeof value)

function normalizeConditions(conditions={}){
 if(!conditions||typeof conditions!=='object'||Array.isArray(conditions))throw new Error('Las condiciones de una regla deben ser un objeto.')
 const entries=Object.entries(conditions)
 if(entries.some(([,value])=>!primitive(value)&&value!=='*'))throw new Error('Las condiciones solo admiten valores JSON primitivos o wildcard.')
 return Object.freeze(Object.fromEntries(entries))
}

export function defineRuleSet({id,defaultValue,rules=[]}={}){
 const ruleSetId=text(id);if(!ruleSetId)throw new Error('El rule set necesita id.')
 const ids=new Set()
 const normalized=list(rules).map((rule,index)=>{
  const ruleId=text(rule?.id||`${ruleSetId}:${index+1}`)
  if(ids.has(ruleId))throw new Error(`Regla duplicada: ${ruleId}`);ids.add(ruleId)
  if(!Object.hasOwn(rule||{},'value'))throw new Error(`La regla ${ruleId} necesita value.`)
  return Object.freeze({id:ruleId,value:structuredClone(rule.value),priority:Number(rule.priority||0),conditions:normalizeConditions(rule.conditions||{}),active:rule.active!==false,metadata:Object.freeze(structuredClone(rule.metadata||{}))})
 })
 return Object.freeze({id:ruleSetId,defaultValue:structuredClone(defaultValue),rules:Object.freeze(normalized)})
}

function matches(conditions,context){
 return Object.entries(conditions).every(([key,expected])=>expected==='*'||context?.[key]===expected)
}

function specificity(conditions){return Object.values(conditions).filter(value=>value!=='*').length}

export function evaluateRuleSet(ruleSet,context={}){
 if(!ruleSet?.id||!Array.isArray(ruleSet.rules))throw new Error('Rule set inválido.')
 const candidates=ruleSet.rules.filter(rule=>rule.active&&matches(rule.conditions,context)).sort((a,b)=>b.priority-a.priority||specificity(b.conditions)-specificity(a.conditions)||a.id.localeCompare(b.id))
 const winner=candidates[0]
 return Object.freeze({ruleSetId:ruleSet.id,value:structuredClone(winner?winner.value:ruleSet.defaultValue),source:winner?'rule':'default',ruleId:winner?.id||null,matchedRuleIds:Object.freeze(candidates.map(rule=>rule.id))})
}

export function explainRuleDecision(ruleSet,context={}){
 const result=evaluateRuleSet(ruleSet,context)
 return Object.freeze({...result,context:Object.freeze(structuredClone(context))})
}
