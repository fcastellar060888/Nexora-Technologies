import{createActionEngine,defineAction}from'../core/actions/index.js'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{executePropagationBatchCommand}from'./propagationBatchCommand.js'
import{executePropagationPromotionCommand}from'./propagationPromotionCommand.js'
import{hasPermission}from'./permissions.js'

export const PlantActions=Object.freeze({
 CREATE_PROPAGATION_BATCH:'plant.propagation.cut',
 PROMOTE_PROPAGATION_UNITS:'propagation.batch.promote'
})

const permission=state=>hasPermission(state,'manage_cultivation')||'No tienes permiso para administrar propagación.'
const sameOrganization=(state,target)=>target.organizationId===activeOrganizationId(state)||'El objeto objetivo no pertenece a la organización activa.'

export function createPlantActionEngine(state,deps={}){
 const engine=createActionEngine()
 engine.register(defineAction({
  id:PlantActions.CREATE_PROPAGATION_BATCH,
  label:'Crear corte de propagación',
  targetTypes:['material-plant'],
  authorize:({target})=>permission(state)===true?sameOrganization(state,target):permission(state),
  validate:({target,input})=>String(input.sourcePlantId||'')===target.id||'La planta de origen de la acción no coincide con el objeto seleccionado.',
  execute:({input})=>executePropagationBatchCommand(state,input,deps)
 }))
 engine.register(defineAction({
  id:PlantActions.PROMOTE_PROPAGATION_UNITS,
  label:'Promover esquejes enraizados',
  targetTypes:['propagation-batch'],
  authorize:({target})=>permission(state)===true?sameOrganization(state,target):permission(state),
  validate:({target,input})=>String(input.batchId||'')===target.id||'El lote de la promoción no coincide con el objeto seleccionado.',
  execute:({input})=>executePropagationPromotionCommand(state,input,deps)
 }))
 return engine
}

export function plantActionsForTarget(state,target,deps={}){
 const engine=createPlantActionEngine(state,deps)
 return engine.list({targetType:target.type})
}

export function executePlantAction(state,actionId,{target,input},deps={}){
 return createPlantActionEngine(state,deps).execute(actionId,{target,input})
}
