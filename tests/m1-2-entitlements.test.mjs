import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{capabilityForPath,hasEntitlement,PRODUCT_CAPABILITIES,requireEntitlement,resolveEntitlement}from'../src/domain/entitlements.js'
import{hasPermission as hasScopedPermission}from'../src/domain/accessControl.js'

const baseState={
 companies:[{id:'org-a'},{id:'org-b'}],sites:[{id:'site-a',companyId:'org-a'}],
 roles:[{id:'role-admin',permissions:['manage_mipe','manage_mirfe']}],
 memberships:[{id:'m1',userId:'u1',companyId:'org-a',roleId:'role-admin',siteIds:['site-a'],status:'active',permissionOverrides:[],deniedPermissions:[]}],
 currentContext:{companyId:'org-a',siteId:'site-a'},entitlements:[]
}

test('M12-F007: IAM permission and product entitlement are independent authorities',()=>{
 const state={...baseState,entitlements:[{id:'mirfe',organizationId:'org-a',capability:'mirfe',status:'active'}]}
 assert.equal(hasScopedPermission({state,userId:'u1',companyId:'org-a',siteId:'site-a',permission:'manage_mipe'}),true)
 assert.equal(hasEntitlement(state,PRODUCT_CAPABILITIES.MIPE),false)
 assert.equal(hasEntitlement(state,PRODUCT_CAPABILITIES.MIRFE),true)
})

test('M12-F007: entitlement from another tenant never enables the active organization',()=>{
 const state={...baseState,entitlements:[{id:'foreign',organizationId:'org-b',capability:'mipe',status:'active'}]}
 const result=resolveEntitlement(state,'mipe')
 assert.equal(result.allowed,true)
 assert.equal(result.source,'legacy-grandfathered')
 const explicit={...state,entitlements:[{id:'a-mirfe',organizationId:'org-a',capability:'mirfe',status:'active'},{id:'foreign',organizationId:'org-b',capability:'mipe',status:'active'}]}
 assert.equal(resolveEntitlement(explicit,'mipe').allowed,false)
 assert.equal(resolveEntitlement(explicit,'mipe').source,'not-entitled')
})

test('M12-F007: explicit organization contract fails closed for absent or revoked capabilities',()=>{
 const state={...baseState,entitlements:[
  {id:'grant-mirfe',organizationId:'org-a',capability:'mirfe',status:'active'},
  {id:'deny-mipe',organizationId:'org-a',capability:'mipe',status:'revoked'}
 ]}
 assert.equal(resolveEntitlement(state,'mirfe').allowed,true)
 assert.equal(resolveEntitlement(state,'mipe').source,'explicit-deny')
 assert.equal(resolveEntitlement(state,'inventory').source,'not-entitled')
 assert.throws(()=>requireEntitlement(state,'inventory'),/no tiene habilitada/)
})

test('M12-F007: organizations without entitlement contract remain grandfathered for migration compatibility',()=>{
 const result=resolveEntitlement(baseState,'mipe')
 assert.equal(result.allowed,true)
 assert.equal(result.source,'legacy-grandfathered')
})

test('M12-F007: route capability mapping is centralized and deterministic',()=>{
 assert.equal(capabilityForPath('/mipe/findings'),'mipe')
 assert.equal(capabilityForPath('/mirfe/dashboard'),'mirfe')
 assert.equal(capabilityForPath('/irrigation/plan'),'irrigation')
 assert.equal(capabilityForPath('/inventory/movements'),'inventory')
 assert.equal(capabilityForPath('/sales'),'commercial')
 assert.equal(capabilityForPath('/dashboard'),'')
})

test('M12-F007 re-audit: route and navigation both consume the same entitlement authority',async()=>{
 const route=await readFile(new URL('../src/components/ProtectedRoute.jsx',import.meta.url),'utf8')
 const shell=await readFile(new URL('../src/components/AppShell.jsx',import.meta.url),'utf8')
 assert.match(route,/capabilityForPath/)
 assert.match(route,/hasEntitlement/)
 assert.match(route,/deniedEntitlement/)
 assert.match(shell,/capabilityForPath/)
 assert.match(shell,/hasEntitlement/)
 assert.match(shell,/visibleGroups/)
})

test('M12-F007 re-audit: enterprise identity loads entitlements and operational bootstrap cannot replace them',async()=>{
 const supabase=await readFile(new URL('../src/services/supabase.js',import.meta.url),'utf8')
 const bootstrap=await readFile(new URL('../src/services/remoteBootstrap.js',import.meta.url),'utf8')
 assert.match(supabase,/organization_entitlements\?select=\*/)
 assert.match(supabase,/entitlements:entitlements\|\|\[\]/)
 assert.match(bootstrap,/'memberships','entitlements'/)
 assert.match(bootstrap,/entitlements:list\(localState\.entitlements\)/)
})

test('M12-F007 re-audit: entitlement provisioning is RLS-readable but not client-writable',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20260815030000_organization_entitlements.sql',import.meta.url),'utf8')
 assert.match(sql,/alter table public\.organization_entitlements enable row level security/i)
 assert.match(sql,/for select to authenticated/i)
 assert.match(sql,/public\.is_org_member\(organization_id\)/)
 assert.doesNotMatch(sql,/for insert to authenticated/i)
 assert.doesNotMatch(sql,/for update to authenticated/i)
 assert.doesNotMatch(sql,/for delete to authenticated/i)
})
