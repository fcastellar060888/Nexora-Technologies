import{getSession,supabaseConfig,supabaseEnabled}from'./supabase.js'

const HEARTBEAT_MS=25000
const RECONNECT_BASE_MS=1000
const RECONNECT_MAX_MS=30000
const DEVICE_KEY='canapa_device_id'

function deviceId(){
 let id=localStorage.getItem(DEVICE_KEY)||localStorage.getItem('cannapa_device_id')
 if(!id){id=crypto.randomUUID()}
 localStorage.setItem(DEVICE_KEY,id)
 return id
}

export function realtimeSocketUrl(baseUrl,apiKey){
 const url=new URL(baseUrl.replace(/^http/,'ws').replace(/\/$/,'')+'/realtime/v1/websocket')
 url.searchParams.set('apikey',apiKey)
 url.searchParams.set('vsn','1.0.0')
 return url.toString()
}

export function normalizePresenceState(state={}){
 return Object.values(state).flatMap(entries=>Array.isArray(entries)?entries:[]).map(entry=>entry?.metas?.[0]||entry).filter(Boolean)
}

export function createRealtimePresence({organizationId,user,onStatus,onPresence,onEvent}={}){
 let socket=null,heartbeat=null,reconnect=null,attempt=0,ref=0,closed=false
 const topic=`realtime:canapa:${organizationId}`
 const emitStatus=(status,error='')=>onStatus?.({status,error,attempt,organizationId})
 const send=(event,payload={},joinRef=null)=>{
  if(socket?.readyState!==WebSocket.OPEN)return false
  ref+=1
  socket.send(JSON.stringify({topic,event,payload,ref:String(ref),join_ref:joinRef}))
  return true
 }
 const connect=async()=>{
  if(closed||!organizationId||!supabaseEnabled)return
  clearTimeout(reconnect)
  emitStatus(attempt?'reconnecting':'connecting')
  const{data}=await getSession()
  const token=data.session?.access_token||supabaseConfig.anonKey
  socket=new WebSocket(realtimeSocketUrl(supabaseConfig.url,supabaseConfig.anonKey))
  socket.onopen=()=>{
   attempt=0
   const joinRef=String(++ref)
   socket.send(JSON.stringify({topic,event:'phx_join',payload:{config:{broadcast:{ack:false,self:false},presence:{key:user?.id||deviceId()},postgres_changes:[]},access_token:token},ref:joinRef,join_ref:joinRef}))
   heartbeat=setInterval(()=>send('heartbeat',{},null),HEARTBEAT_MS)
  }
  socket.onmessage=message=>{
   let packet
   try{packet=JSON.parse(message.data)}catch{return}
   if(packet.event==='phx_reply'&&packet.payload?.status==='ok'){
    emitStatus('connected')
    send('presence_track',{user_id:user?.id||'',name:user?.name||user?.email||'Usuario',email:user?.email||'',device_id:deviceId(),organization_id:organizationId,online_at:new Date().toISOString()})
   }
   if(packet.event==='presence_state')onPresence?.(normalizePresenceState(packet.payload))
   if(packet.event==='presence_diff')onEvent?.({type:'presence-diff',payload:packet.payload})
   if(packet.event==='broadcast')onEvent?.({type:packet.payload?.event||'broadcast',payload:packet.payload?.payload})
   if(packet.event==='phx_error')emitStatus('error','Error del canal Realtime')
  }
  socket.onerror=()=>emitStatus('error','No fue posible conectar con Realtime')
  socket.onclose=()=>{
   clearInterval(heartbeat);heartbeat=null
   if(closed)return emitStatus('disconnected')
   attempt+=1
   emitStatus('reconnecting')
   reconnect=setTimeout(connect,Math.min(RECONNECT_BASE_MS*2**(attempt-1),RECONNECT_MAX_MS))
  }
 }
 connect()
 return{
  broadcast(event,payload){return send('broadcast',{type:'broadcast',event,payload})},
  destroy(){closed=true;clearInterval(heartbeat);clearTimeout(reconnect);socket?.close();socket=null;emitStatus('disconnected')}
 }
}
