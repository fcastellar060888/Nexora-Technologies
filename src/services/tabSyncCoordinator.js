export const LEASE_MS=20000
export const HEARTBEAT_MS=5000
const CHANNEL='cannapa_sync_coordination'
const LEASE_KEY='cannapa_sync_leader'

export function leaseExpired(lease,now=Date.now()){
 return !lease||!Number(lease.expiresAt)||Number(lease.expiresAt)<=now
}

export function canAcquireLease(lease,tabId,now=Date.now()){
 return leaseExpired(lease,now)||lease.tabId===tabId
}

function readLease(){
 try{return JSON.parse(localStorage.getItem(LEASE_KEY)||'null')}catch{return null}
}

function writeLease(value){localStorage.setItem(LEASE_KEY,JSON.stringify(value))}

export function createTabSyncCoordinator({tabId=crypto.randomUUID(),onMessage=()=>{}}={}){
 const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel(CHANNEL)
 let heartbeat=null

 function broadcast(type,payload={}){
  channel?.postMessage({type,tabId,at:new Date().toISOString(),...payload})
 }

 function acquire(){
  const now=Date.now()
  const lease=readLease()
  if(!canAcquireLease(lease,tabId,now))return false
  writeLease({tabId,expiresAt:now+LEASE_MS})
  const confirmed=readLease()
  if(confirmed?.tabId!==tabId)return false
  if(!heartbeat)heartbeat=setInterval(()=>writeLease({tabId,expiresAt:Date.now()+LEASE_MS}),HEARTBEAT_MS)
  broadcast('leader-acquired')
  return true
 }

 function release(){
  const lease=readLease()
  if(lease?.tabId===tabId)localStorage.removeItem(LEASE_KEY)
  if(heartbeat){clearInterval(heartbeat);heartbeat=null}
  broadcast('leader-released')
 }

 function isLeader(){return readLease()?.tabId===tabId&&!leaseExpired(readLease())}
 function destroy(){release();channel?.close()}
 if(channel)channel.onmessage=event=>{if(event.data?.tabId!==tabId)onMessage(event.data)}
 return{tabId,acquire,release,isLeader,broadcast,destroy}
}
