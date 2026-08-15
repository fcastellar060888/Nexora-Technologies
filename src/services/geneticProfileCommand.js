import{DomainEvents,publishDomainEvent}from'../core/events/index.js'
import{archiveGeneticProfile,createGeneticProfile,updateGeneticProfile,upsertGeneticProfile}from'../domain/geneticProfile.js'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{hasPermission}from'./permissions.js'
import{executeCoreOperationCommand}from'./coreOperationCommand.js'

export const GENETIC_OPERATIONS=Object.freeze({CREATE:'CREATE',UPDATE:'UPDATE',ARCHIVE:'ARCHIVE'})

export async function executeGeneticProfileCommand(state,{operation,input={},geneticId='',commandId=crypto.randomUUID(),occurredAt=new Date().toISOString()}={},deps={}){
 if(!hasPermission(state,'manage_cultivation'))throw new Error('No tienes permiso para administrar genéticas.')
 const organizationId=activeOrganizationId(state)
 let profile,eventName
 if(operation===GENETIC_OPERATIONS.CREATE){profile=createGeneticProfile(state,input,{id:geneticId||crypto.randomUUID(),now:occurredAt});eventName=DomainEvents.GENETIC_PROFILE_CREATED}
 else if(operation===GENETIC_OPERATIONS.UPDATE){profile=updateGeneticProfile(state,geneticId,input,{now:occurredAt});eventName=DomainEvents.GENETIC_PROFILE_UPDATED}
 else if(operation===GENETIC_OPERATIONS.ARCHIVE){profile=archiveGeneticProfile(state,geneticId,{now:occurredAt});eventName=DomainEvents.GENETIC_PROFILE_ARCHIVED}
 else throw new Error('Operación de genética no soportada.')
 const publishEvent=deps.publishEvent||((event)=>publishDomainEvent(state,event))
 const commit=deps.commit
 if(typeof commit!=='function')throw new TypeError('commit es obligatorio para ejecutar el comando de genética.')
 await executeCoreOperationCommand({
  commandId,organizationId,aggregateType:'genetic-profile',aggregateId:profile.id,completedEventName:eventName,occurredAt,
  payload:{name:profile.name,classification:profile.classification,active:profile.active},
  metadata:{module:'genetics'},
  apply:current=>upsertGeneticProfile(current,profile)
 },{publishEvent,commit})
 return Object.freeze({ok:true,commandId,profile})
}
