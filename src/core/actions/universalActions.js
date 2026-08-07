import{defineAction}from'./actionEngine.js'

function commandHandler(commands,name){
 const handler=commands?.[name]
 if(typeof handler!=='function')throw new Error(`Falta el comando universal ${name}`)
 return handler
}

export function createUniversalActions(commands={}){
 const move=commandHandler(commands,'move')
 const changeStatus=commandHandler(commands,'changeStatus')
 const harvest=commandHandler(commands,'harvest')
 const observe=commandHandler(commands,'observe')

 return Object.freeze([
  defineAction({
   id:'object.move',label:'Mover',eventName:'core.object.moved',
   validate:({input})=>input?.destinationId?'true'==='true':'El destino es obligatorio',
   execute:({target,input,actor,context,executionId,occurredAt})=>move({target,input,actor,context,executionId,occurredAt})
  }),
  defineAction({
   id:'object.change-status',label:'Cambiar estado',eventName:'core.object.statuschanged',
   validate:({input})=>String(input?.status??'').trim()?true:'El nuevo estado es obligatorio',
   execute:({target,input,actor,context,executionId,occurredAt})=>changeStatus({target,input,actor,context,executionId,occurredAt})
  }),
  defineAction({
   id:'object.harvest',label:'Cosechar',eventName:'core.object.harvested',
   execute:({target,input,actor,context,executionId,occurredAt})=>harvest({target,input,actor,context,executionId,occurredAt})
  }),
  defineAction({
   id:'object.observe',label:'Registrar observación',eventName:'core.object.observed',
   validate:({input})=>String(input?.title??'').trim()?true:'El título de la observación es obligatorio',
   execute:({target,input,actor,context,executionId,occurredAt})=>observe({target,input,actor,context,executionId,occurredAt})
  })
 ])
}

export function registerUniversalActions(engine,commands){
 if(!engine?.register)throw new Error('El Action Engine es obligatorio')
 return createUniversalActions(commands).map(definition=>engine.register(definition))
}
