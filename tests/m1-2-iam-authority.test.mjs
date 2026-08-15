import test from'node:test'
import assert from'node:assert/strict'
import{hasPermission,isInstallationMode}from'../src/services/permissions.js'
import{readFile}from'node:fs/promises'

const base={companies:[{id:'org-a'},{id:'org-b'}],sites:[{id:'site-a',companyId:'org-a'},{id:'site-b',companyId:'org-a'}],roles:[{id:'operator',permissions:['record_observations','manage_mipe']}],memberships:[],users:[],currentContext:{companyId:'org-a',siteId:'site-a'}}

test('M1.2 IAM: usuario remoto sin membership no hereda permisos de rol local',()=>{
 const state={...base,users:[{id:'u1',remote:true,active:true,activeSession:true,role:'Administrador'}]}
 assert.equal(hasPermission(state,'manage_mipe'),false)
})

test('M1.2 IAM: membership de otra organización no autoriza el tenant activo',()=>{
 const state={...base,users:[{id:'u1',remote:true,active:true,activeSession:true}],memberships:[{id:'m1',userId:'u1',companyId:'org-b',roleId:'operator',siteIds:[],status:'active'}]}
 assert.equal(hasPermission(state,'manage_mipe'),false)
})

test('M1.2 IAM: membership restringida a otra sede no autoriza la sede activa',()=>{
 const state={...base,users:[{id:'u1',remote:true,active:true,activeSession:true}],memberships:[{id:'m1',userId:'u1',companyId:'org-a',roleId:'operator',siteIds:['site-b'],status:'active'}]}
 assert.equal(hasPermission(state,'record_observations'),false)
 assert.equal(hasPermission(state,'record_observations',{siteId:'site-b'}),true)
})

test('M1.2 IAM: perfil local legacy se adapta al mismo evaluador scoped',()=>{
 const state={...base,users:[{id:'local-1',active:true,activeSession:true,role:'Operario',siteId:'site-a'}]}
 assert.equal(hasPermission(state,'record_observations'),true)
 assert.equal(hasPermission(state,'manage_mipe'),false)
 assert.equal(hasPermission(state,'record_observations',{siteId:'site-b'}),false)
})

test('M1.2 IAM: installation mode solo existe sin identidad, memberships ni organizaciones',()=>{
 assert.equal(isInstallationMode({users:[],memberships:[],companies:[]}),true)
 assert.equal(isInstallationMode({users:[],memberships:[],companies:[{id:'org-a'}]}),false)
})

test('M1.2 IAM: ProtectedRoute usa el adaptador canónico y no users.length como bypass',async()=>{
 const source=await readFile(new URL('../src/components/ProtectedRoute.jsx',import.meta.url),'utf8')
 assert.match(source,/isInstallationMode/)
 assert.match(source,/hasPermission\(state, permission\)/)
 assert.doesNotMatch(source,/users\.length\s*===\s*0/)
})
