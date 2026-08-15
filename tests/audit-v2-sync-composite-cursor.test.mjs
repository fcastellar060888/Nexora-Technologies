import test from'node:test'
import assert from'node:assert/strict'
import{advancePullCursor,buildPullPath,normalizePullCursor}from'../src/services/syncTransport.js'

test('Auditoría V2 sync: cursor legado por timestamp migra a cursor compuesto sin perder el borde',()=>{
 const cursor=normalizePullCursor('2026-08-07T15:00:00.000Z')
 assert.deepEqual(cursor,{updatedAt:'2026-08-07T15:00:00.000Z',recordId:''})
 const path=decodeURIComponent(buildPullPath('company-a',cursor))
 assert.match(path,/organization_id=eq\.company-a/)
 assert.match(path,/updated_at\.gt\."2026-08-07T15:00:00\.000Z"/)
 assert.match(path,/updated_at\.eq\."2026-08-07T15:00:00\.000Z"/)
 assert.match(path,/record_id\.gt\.""/)
 assert.match(path,/order=updated_at\.asc,record_id\.asc/)
 assert.match(path,/limit=1000/)
})

test('Auditoría V2 sync: el siguiente page cursor conserva timestamp y avanza por record_id',()=>{
 const timestamp='2026-08-07T15:00:00.000Z'
 const page=Array.from({length:1000},(_,index)=>({updatedAt:timestamp,recordId:`record-${String(index+1).padStart(4,'0')}`}))
 const cursor=advancePullCursor({updatedAt:timestamp,recordId:''},page)
 assert.deepEqual(cursor,{updatedAt:timestamp,recordId:'record-1000'})
 const nextPath=decodeURIComponent(buildPullPath('company-a',cursor))
 assert.match(nextPath,/updated_at\.eq\."2026-08-07T15:00:00\.000Z"/)
 assert.match(nextPath,/record_id\.gt\."record-1000"/)
})

test('Auditoría V2 sync: avanzar a timestamp posterior reinicia naturalmente la frontera por la nueva tupla',()=>{
 const cursor=advancePullCursor(
  {updatedAt:'2026-08-07T15:00:00.000Z',recordId:'record-1000'},
  [{updatedAt:'2026-08-07T15:00:01.000Z',recordId:'record-0001'}]
 )
 assert.deepEqual(cursor,{updatedAt:'2026-08-07T15:00:01.000Z',recordId:'record-0001'})
})
