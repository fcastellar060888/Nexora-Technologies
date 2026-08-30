import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const read=path=>readFile(new URL(path,import.meta.url),'utf8')

test('M4.7 browser admin service fails closed without remote authority',async()=>{
 const source=await read('../src/services/authAdminService.js')
 assert.match(source,/if\(!supabaseEnabled\)throw new Error/)
 assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY|service_role/i)
 assert.match(source,/authenticatedRequest\('\/functions\/v1\/admin-users'/)
})

test('M4.7 Edge authority requires caller membership and manage_users permission',async()=>{
 const source=await read('../supabase/functions/admin-users/index.ts')
 assert.match(source,/callerId\(authorization\)/)
 assert.match(source,/assertManageUsers\(caller,organizationId\)/)
 assert.match(source,/membership\.status\).*active|text\(membership\.status\)!=='active'/)
 assert.match(source,/permissions\.includes\('manage_users'\)/)
 assert.match(source,/SUPABASE_SERVICE_ROLE_KEY/)
})

test('M4.7 membership mutations remain tenant-scoped even when IDs collide across organizations',async()=>{
 const source=await read('../supabase/functions/admin-users/index.ts')
 assert.match(source,/membershipMutationTarget\(membership,organizationId,userId\)/)
 assert.match(source,/organization_id=eq\.\$\{encodeURIComponent\(organizationId\)\}/)
 assert.match(source,/user_id=eq\.\$\{encodeURIComponent\(userId\)\}/)
 assert.match(source,/if\(rows\.length!==1\)throw new Error\('La actualización de membresía no afectó exactamente una fila tenant-scoped'\)/)
 assert.match(source,/if\(removed\.length!==1\)throw new Error\('La eliminación de membresía no afectó exactamente una fila tenant-scoped'\)/)
 assert.doesNotMatch(source,/memberships\?id=eq\.\$\{encodeURIComponent\(text\(membership\.id\)\)\}`/)
})

test('M4.7 enterprise UI derives rows and mutations from active organization view',async()=>{
 const source=await read('../src/pages/UsersPage.jsx')
 assert.match(source,/identityAdministrationView\(state\)/)
 assert.match(source,/enterpriseRows=enterpriseView\?\.members/)
 assert.match(source,/organizationId=enterpriseView\?\.organizationId/)
 assert.match(source,/updateRemoteMembershipStatus\(userId,\{organizationId,status\}\)/)
 assert.match(source,/removeRemoteMembership\(userId,\{organizationId\}\)/)
 assert.doesNotMatch(source,/enterpriseMode\?<span className="tag">Gestionado externamente<\/span>/)
})
