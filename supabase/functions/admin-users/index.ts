const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS'
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})
const text=(value:unknown)=>String(value??'').trim()
const list=(value:unknown)=>Array.isArray(value)?value:[]
const requiredEnv=(name:string)=>{const value=Deno.env.get(name);if(!value)throw new Error(`Falta ${name}`);return value}
const SUPABASE_URL=requiredEnv('SUPABASE_URL')
const ANON_KEY=requiredEnv('SUPABASE_ANON_KEY')
const ADMIN_KEY=requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

async function decode(response:Response){
 const raw=await response.text()
 let body:unknown=null
 try{body=raw?JSON.parse(raw):null}catch{body=raw}
 if(!response.ok){const message=typeof body==='object'&&body&&'message'in body?String((body as {message?:unknown}).message):raw||`HTTP ${response.status}`;throw new Error(message)}
 return body
}
async function adminFetch(path:string,options:RequestInit={}){
 const headers=new Headers(options.headers||{})
 headers.set('apikey',ADMIN_KEY);headers.set('Authorization',`Bearer ${ADMIN_KEY}`)
 if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json')
 return decode(await fetch(`${SUPABASE_URL}${path}`,{...options,headers}))
}
async function callerId(authorization:string){
 const response=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:ANON_KEY,Authorization:authorization}})
 const user=await decode(response) as {id?:unknown}
 const id=text(user?.id);if(!id)throw new Error('Sesión administrativa inválida')
 return id
}
async function oneMembership(organizationId:string,userId:string){
 const rows=list(await adminFetch(`/rest/v1/memberships?select=id,user_id,organization_id,role_id,status,site_ids&organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(userId)}&limit=2`)) as Array<Record<string,unknown>>
 if(rows.length!==1)throw new Error(rows.length?'Membresía duplicada o ambigua':'El usuario no tiene membresía en la empresa')
 return rows[0]
}
async function roleById(roleId:string){
 const rows=list(await adminFetch(`/rest/v1/roles?select=id,organization_id,permissions,is_system,active&id=eq.${encodeURIComponent(roleId)}&limit=2`)) as Array<Record<string,unknown>>
 if(rows.length!==1)throw new Error(rows.length?'Rol duplicado o ambiguo':'Rol no encontrado')
 return rows[0]
}
function roleBelongsToOrganization(role:Record<string,unknown>,organizationId:string){return role.is_system===true||text(role.organization_id)===organizationId}
async function assertManageUsers(caller:string,organizationId:string){
 const membership=await oneMembership(organizationId,caller)
 if(text(membership.status)!=='active')throw new Error('La membresía administrativa no está activa')
 const role=await roleById(text(membership.role_id))
 if(role.active===false||!roleBelongsToOrganization(role,organizationId))throw new Error('El rol administrativo no pertenece a la empresa')
 const permissions=list(role.permissions).map(text)
 if(!permissions.includes('*')&&!permissions.includes('manage_users'))throw new Error('No tienes permiso para administrar usuarios')
 return membership
}
async function assertAssignableRole(roleId:string,organizationId:string){
 const role=await roleById(roleId)
 if(role.active===false||!roleBelongsToOrganization(role,organizationId))throw new Error('El rol seleccionado no pertenece a la empresa activa')
 return role
}
async function assertSites(siteIds:string[],organizationId:string){
 const ids=[...new Set(siteIds.map(text).filter(Boolean))]
 if(!ids.length)return[]
 const filter=ids.map(id=>`"${id.replaceAll('"','\\"')}"`).join(',')
 const rows=list(await adminFetch(`/rest/v1/sites?select=id,organization_id&id=in.(${encodeURIComponent(filter)})`)) as Array<Record<string,unknown>>
 const valid=new Set(rows.filter(row=>text(row.organization_id)===organizationId).map(row=>text(row.id)))
 if(ids.some(id=>!valid.has(id)))throw new Error('Una o más sedes no pertenecen a la empresa activa')
 return ids
}
async function createMember(payload:Record<string,unknown>,organizationId:string){
 const email=text(payload.email).toLowerCase(),password=String(payload.password??''),name=text(payload.name),roleId=text(payload.roleId)
 if(!email||!roleId)throw new Error('Correo y rol son obligatorios')
 if(password.length<8)throw new Error('La contraseña temporal debe tener al menos 8 caracteres')
 await assertAssignableRole(roleId,organizationId)
 const siteIds=await assertSites(list(payload.siteIds).map(text),organizationId)
 let authUserId=''
 try{
  const created=await adminFetch('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name}})}) as {id?:unknown,user?:{id?:unknown}}
  authUserId=text(created?.id||created?.user?.id)
  if(!authUserId)throw new Error('Auth no devolvió identidad para el usuario creado')
  const at=new Date().toISOString()
  await adminFetch('/rest/v1/profiles?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id:authUserId,name:name||email,email,active:true,created_at:at,updated_at:at})})
  const memberships=list(await adminFetch('/rest/v1/memberships',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:authUserId,organization_id:organizationId,role_id:roleId,site_ids:siteIds,status:'active',created_at:at,updated_at:at})})) as Array<Record<string,unknown>>
  return{user:{id:authUserId,name:name||email,email,active:true},membership:memberships[0]||{user_id:authUserId,organization_id:organizationId,role_id:roleId,site_ids:siteIds,status:'active'}}
 }catch(error){
  if(authUserId){try{await adminFetch(`/rest/v1/memberships?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(authUserId)}`,{method:'DELETE'})}catch{};try{await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(authUserId)}`,{method:'DELETE'})}catch{};try{await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(authUserId)}`,{method:'DELETE'})}catch{}}
  throw error
 }
}
async function changeMembership(payload:Record<string,unknown>,organizationId:string,caller:string){
 const userId=text(payload.userId),action=text(payload.action)
 if(!userId)throw new Error('Falta userId')
 if(userId===caller&&(action==='remove_membership'||text(payload.status)==='inactive'))throw new Error('No puedes retirar tu propia membresía administrativa desde esta operación')
 const membership=await oneMembership(organizationId,userId)
 if(action==='set_membership_status'){
  const status=text(payload.status);if(!['active','inactive'].includes(status))throw new Error('Estado de membresía inválido')
  const rows=list(await adminFetch(`/rest/v1/memberships?id=eq.${encodeURIComponent(text(membership.id))}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status,updated_at:new Date().toISOString()})}))
  return{membership:rows[0]||{...membership,status}}
 }
 await adminFetch(`/rest/v1/memberships?id=eq.${encodeURIComponent(text(membership.id))}`,{method:'DELETE'})
 return{removed:true,userId,organizationId}
}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return json({error:'Método no permitido'},405)
 try{
  const authorization=req.headers.get('Authorization')||''
  if(!authorization.startsWith('Bearer '))return json({error:'No autenticado'},401)
  const payload=await req.json() as Record<string,unknown>
  const organizationId=text(payload.organizationId),action=text(payload.action)
  if(!organizationId)return json({error:'organizationId es obligatorio'},400)
  const caller=await callerId(authorization)
  await assertManageUsers(caller,organizationId)
  if(action==='create_member')return json(await createMember(payload,organizationId),201)
  if(action==='set_membership_status'||action==='remove_membership')return json(await changeMembership(payload,organizationId,caller))
  return json({error:'Acción administrativa no soportada'},400)
 }catch(error){return json({error:error instanceof Error?error.message:'Error administrativo'},400)}
})
