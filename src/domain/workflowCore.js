const DEFAULT_TERMINAL_STATES=new Set(['completed','cancelled','closed','archived'])

function required(value,label){
 if(value===undefined||value===null||value==='')throw new Error(`${label} es obligatorio`)
 return value
}

function clone(value){return structuredClone(value)}

export function defineWorkflow({id,initialState,states,transitions,terminalStates=[]}){
 required(id,'El identificador del workflow')
 required(initialState,'El estado inicial')
 if(!Array.isArray(states)||states.length===0)throw new Error('El workflow debe declarar estados')
 if(!states.includes(initialState))throw new Error(`El estado inicial ${initialState} no está declarado`)
 const stateSet=new Set(states),transitionMap=new Map()
 for(const transition of transitions||[]){
  const name=required(transition.name,'El nombre de la transición')
  const from=Array.isArray(transition.from)?transition.from:[transition.from]
  const to=required(transition.to,`El destino de ${name}`)
  if(from.some(state=>!stateSet.has(state)))throw new Error(`La transición ${name} parte de un estado no declarado`)
  if(!stateSet.has(to))throw new Error(`La transición ${name} llega a un estado no declarado`)
  if(transitionMap.has(name))throw new Error(`La transición ${name} está duplicada`)
  transitionMap.set(name,{...transition,from,to})
 }
 return Object.freeze({id,initialState,states:Object.freeze([...states]),transitions:transitionMap,terminalStates:new Set([...DEFAULT_TERMINAL_STATES,...terminalStates])})
}

export function createWorkflowInstance(definition,{entityType,entityId,companyId='',metadata={},actor={},occurredAt=new Date().toISOString(),eventId=crypto.randomUUID()}={}){
 required(definition?.id,'La definición del workflow');required(entityType,'El tipo de entidad');required(entityId,'El identificador de la entidad')
 const event={id:eventId,workflowId:definition.id,entityType,entityId,companyId,type:'workflow.created',transition:'create',from:null,to:definition.initialState,occurredAt,actor:clone(actor),metadata:clone(metadata)}
 return Object.freeze({workflowId:definition.id,entityType,entityId,companyId,state:definition.initialState,version:1,createdAt:occurredAt,updatedAt:occurredAt,metadata:clone(metadata),history:Object.freeze([Object.freeze(event)])})
}

export function availableTransitions(definition,instance,context={}){
 if(!definition||!instance)return[]
 return[...definition.transitions.values()].filter(transition=>{
  if(!transition.from.includes(instance.state))return false
  if(typeof transition.guard!=='function')return true
  try{return transition.guard({instance:clone(instance),context:clone(context)})===true}catch{return false}
 }).map(transition=>transition.name)
}

export function transitionWorkflow(definition,instance,transitionName,{actor={},metadata={},context={},occurredAt=new Date().toISOString(),eventId=crypto.randomUUID()}={}){
 required(definition?.id,'La definición del workflow');required(instance?.workflowId,'La instancia del workflow')
 if(instance.workflowId!==definition.id)throw new Error('La instancia no pertenece a esta definición de workflow')
 if(definition.terminalStates.has(instance.state))throw new Error(`El workflow está cerrado en el estado ${instance.state}`)
 const transition=definition.transitions.get(transitionName)
 if(!transition)throw new Error(`La transición ${transitionName} no existe`)
 if(!transition.from.includes(instance.state))throw new Error(`La transición ${transitionName} no está permitida desde ${instance.state}`)
 const guardInput={instance:clone(instance),context:clone(context),metadata:clone(metadata),actor:clone(actor)}
 if(typeof transition.guard==='function'&&transition.guard(guardInput)!==true)throw new Error(transition.guardMessage||`No se cumplen las condiciones para ejecutar ${transitionName}`)
 const event=Object.freeze({id:eventId,workflowId:definition.id,entityType:instance.entityType,entityId:instance.entityId,companyId:instance.companyId,type:'workflow.transitioned',transition:transition.name,from:instance.state,to:transition.to,occurredAt,actor:clone(actor),metadata:clone(metadata)})
 const nextMetadata=typeof transition.reduce==='function'?transition.reduce({instance:clone(instance),context:clone(context),metadata:clone(metadata)}):{...instance.metadata,...metadata}
 return Object.freeze({...clone(instance),state:transition.to,version:instance.version+1,updatedAt:occurredAt,metadata:clone(nextMetadata),history:Object.freeze([...(instance.history||[]),event])})
}

export function verifyWorkflowHistory(definition,instance){
 const errors=[],history=instance?.history||[]
 if(history.length===0)return{valid:false,errors:['El workflow no tiene historial']}
 if(history[0].type!=='workflow.created')errors.push('El primer evento debe crear el workflow')
 if(history[0].to!==definition.initialState)errors.push('El historial no comienza en el estado inicial')
 for(let index=1;index<history.length;index+=1){
  const previous=history[index-1],current=history[index]
  if(current.from!==previous.to)errors.push(`Ruptura de continuidad en el evento ${current.id}`)
  const transition=definition.transitions.get(current.transition)
  if(!transition)errors.push(`Transición desconocida en el evento ${current.id}`)
  else if(!transition.from.includes(current.from)||transition.to!==current.to)errors.push(`Transición inválida en el evento ${current.id}`)
 }
 if(history.at(-1)?.to!==instance.state)errors.push('El estado actual no coincide con el último evento')
 if(instance.version!==history.length)errors.push('La versión no coincide con la cantidad de eventos')
 return{valid:errors.length===0,errors}
}
