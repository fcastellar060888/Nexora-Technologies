export const ROLE_PERMISSIONS={
 'Administrador':['*'],
 'Gerente':['view_dashboards','view_costs','view_audit','export_data'],
 'Agrónomo':['view_dashboards','manage_mipe','manage_mirfe','manage_irrigation','approve_formulas','view_inventory','view_production'],
 'Supervisor':['view_dashboards','manage_mipe','manage_mirfe','execute_orders','view_inventory','manage_production'],
 'Encargado de riego':['view_irrigation','execute_orders','record_irrigation','view_inventory'],
 'Encargado MIPE':['manage_mipe','execute_treatments','view_inventory'],
 'Operario':['execute_orders','record_observations','manage_production'],
 'Inventario':['manage_inventory','view_costs']
}

export function activeUser(state){
 return(state.users||[]).find(x=>x.activeSession)||null
}

export function hasPermission(state,permission){
 const users=state.users||[]
 if(users.length===0)return true // modo de instalación inicial hasta crear el primer usuario
 const user=activeUser(state)
 if(!user||user.active===false)return false
 const list=ROLE_PERMISSIONS[user.role]||[]
 return list.includes('*')||list.includes(permission)
}
