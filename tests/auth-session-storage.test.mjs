import test from 'node:test'
import assert from 'node:assert/strict'
import { AUTH_SESSION_KEY, LEGACY_AUTH_KEYS, createAuthSessionStorage } from '../src/services/authSessionStorage.js'

function memoryStorage(initial={}) {
  const data=new Map(Object.entries(initial))
  const writes=[]
  return {
    writes,
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>{writes.push([key,String(value)]);data.set(key,String(value))},
    removeItem:key=>data.delete(key),
    has:key=>data.has(key),
  }
}

function channelBus() {
  const channels=[]
  const factory=name=>{
    const channel={name,onmessage:null,closed:false,postMessage(message){for(const peer of channels){if(peer!==channel&&!peer.closed)peer.onmessage?.({data:message})}},close(){channel.closed=true}}
    channels.push(channel)
    return channel
  }
  return {factory,channels}
}

test('AUD-F066: auth session persists only in sessionStorage and removes legacy local tokens',()=>{
  const sessionStorageRef=memoryStorage()
  const localStorageRef=memoryStorage({
    [AUTH_SESSION_KEY]:'forbidden',
    [LEGACY_AUTH_KEYS[0]]:'legacy-a',
    [LEGACY_AUTH_KEYS[1]]:'legacy-b',
  })
  const bus=channelBus()
  const store=createAuthSessionStorage({sessionStorageRef,localStorageRef,broadcastChannelFactory:bus.factory})
  const session={access_token:'access',refresh_token:'refresh',user:{id:'u-1'}}
  store.save(session)

  assert.equal(sessionStorageRef.has(AUTH_SESSION_KEY),true)
  assert.deepEqual(store.load(),session)
  assert.equal(localStorageRef.has(AUTH_SESSION_KEY),false)
  for(const key of LEGACY_AUTH_KEYS)assert.equal(localStorageRef.has(key),false)
  assert.equal(localStorageRef.writes.length,0,'auth storage must never write session/token data to localStorage')
  store.close()
})

test('AUD-F066: corrupt session data is discarded instead of trusted',()=>{
  const sessionStorageRef=memoryStorage({[AUTH_SESSION_KEY]:'{broken-json'})
  const store=createAuthSessionStorage({sessionStorageRef,localStorageRef:memoryStorage(),broadcastChannelFactory:channelBus().factory})
  assert.equal(store.load(),null)
  assert.equal(sessionStorageRef.has(AUTH_SESSION_KEY),false)
  store.close()
})

test('AUD-F066: logout propagates to another tab without broadcasting tokens',()=>{
  const bus=channelBus()
  const firstSession=memoryStorage()
  const secondSession=memoryStorage()
  const first=createAuthSessionStorage({sessionStorageRef:firstSession,localStorageRef:memoryStorage(),broadcastChannelFactory:bus.factory})
  const second=createAuthSessionStorage({sessionStorageRef:secondSession,localStorageRef:memoryStorage(),broadcastChannelFactory:bus.factory})
  const session={access_token:'access',refresh_token:'refresh',user:{id:'u-1'}}
  first.save(session)
  second.save(session)
  const events=[]
  second.subscribe(event=>events.push(event.event))

  first.clear({broadcast:true})

  assert.equal(first.load(),null)
  assert.equal(second.load(),null)
  assert.equal(secondSession.has(AUTH_SESSION_KEY),false)
  assert.ok(events.includes('SIGNED_OUT'))
  first.close();second.close()
})

test('AUD-F066: a failing auth observer cannot prevent session cleanup',()=>{
  const storage=memoryStorage()
  const store=createAuthSessionStorage({sessionStorageRef:storage,localStorageRef:memoryStorage(),broadcastChannelFactory:channelBus().factory})
  store.save({access_token:'a',refresh_token:'r',user:{id:'u'}})
  store.subscribe(()=>{throw new Error('observer failure')})
  assert.doesNotThrow(()=>store.clear())
  assert.equal(store.load(),null)
  store.close()
})
