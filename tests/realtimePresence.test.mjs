import test from'node:test'
import assert from'node:assert/strict'
import{normalizePresenceState,realtimeSocketUrl}from'../src/services/realtimePresence.js'

test('builds Supabase realtime websocket URL',()=>{
 const value=realtimeSocketUrl('https://demo.supabase.co','anon-key')
 assert.equal(value.startsWith('wss://demo.supabase.co/realtime/v1/websocket?'),true)
 assert.equal(value.includes('apikey=anon-key'),true)
 assert.equal(value.includes('vsn=1.0.0'),true)
})

test('normalizes Phoenix presence state',()=>{
 const result=normalizePresenceState({a:[{metas:[{user_id:'1',name:'Ana'}]}],b:[{user_id:'2',name:'Luis'}]})
 assert.deepEqual(result.map(item=>item.user_id),['1','2'])
})
