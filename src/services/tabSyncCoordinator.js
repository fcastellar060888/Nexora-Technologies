export const LEASE_MS=20000
export const HEARTBEAT_MS=5000
const CHANNEL='cannapa_sync_coordination'
const LEASE_KEY='cannapa_sync_leader'
const IDENTITY_KEY='cannapa_cache_v2:identity'

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

export function activeOrganizationId(storage=localStorage){
 try{return JSON.parse(storage.getItem(IDENTITY_KEY)||'null')?.currentContext?.companyId||''}catch{return''}
}

export function isOrganizationMessageAllowed(message,companyId){
 return Boolean(companyId)&&message?.companyId===companyId
}

export function createTabSyncCoordinator({tabId=crypto.randomUUID(),onMessage=()=>{},getCompanyId=()=>activeOrganizationId()}={}){
 const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel(CHANNEL)
 let heartbeat=null

 function broadcast(type,payload={}){
  const companyId=payload.companyId||getCompanyId()
  if(!companyId)return false
  channel?.postMessage({type,tabId,companyId,at:new Date().toISOString(),...payload})
  return true
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
 if(channel)channel.onmessage=event=>{
  const message=event.data
  if(message?.tabId===tabId)return
  if(!isOrganizationMessageAllowed(message,getCompanyId()))return
  onMessage(message)
 }
 return{tabId,acquire,release,isLeader,broadcast,destroy}
}
