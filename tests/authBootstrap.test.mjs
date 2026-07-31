import test from'node:test'
import assert from'node:assert/strict'
import{chooseInitialContext,mapRemoteMembership,mergeRemoteIdentity}from'../src/domain/authBootstrap.js'

test('mapea membresía remota y sedes',()=>{
 const item=mapRemoteMembership({id:'m1',user_id:'u1',organization_id:'c1',role_id:'r1',membership_sites:[{site_id:'s1'}]})
 assert.equal(item.userId,'u1')
 assert.equal(item.companyId,'c1')
 assert.deepEqual(item.siteIds,['s1'])
})

test('elige empresa y sede permitidas',()=>{
 const context=chooseInitialContext({memberships:[{companyId:'c1',siteIds:['s2'],status:'active'}],companies:[{id:'c1'}],sites:[{id:'s1',companyId:'c1'},{id:'s2',companyId:'c1'}]})
 assert.deepEqual(context,{companyId:'c1',siteId:'s2'})
})

test('fusiona identidad remota sin duplicar usuario',()=>{
 const state={users:[{id:'old',email:'admin@cannapa.co',name:'Admin',active:true}],memberships:[]}
 const next=mergeRemoteIdentity(state,{user:{id:'u1',email:'admin@cannapa.co'},profile:{full_name:'Administrador'},memberships:[]})
 assert.equal(next.users.length,1)
 assert.equal(next.users[0].id,'u1')
 assert.equal(next.users[0].activeSession,true)
})
