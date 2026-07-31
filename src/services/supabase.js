const env=import.meta.env||{}
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

export const supabaseEnabled = Boolean(url && anonKey)
export const supabaseConfig={url:url||'',anonKey:anonKey||''}
const TOKEN_KEY = 'canapa_supabase_session'
const LEGACY_TOKEN_KEY='cannapa_supabase_session'
const EXPIRY_MARGIN_SECONDS = 60

function headers(token='') {
  return {
    apikey: anonKey || '',
    Authorization: `Bearer ${token || anonKey || ''}`,
    'Content-Type': 'application/json',
  }
}

function persistSession(session) {
  localStorage.removeItem(LEGACY_TOKEN_KEY)
  if (!session) localStorage.removeItem(TOKEN_KEY)
  else localStorage.setItem(TOKEN_KEY, JSON.stringify(session))
}

function loadSession() {
  try {
    const raw=localStorage.getItem(TOKEN_KEY)||localStorage.getItem(LEGACY_TOKEN_KEY)
    const session = JSON.parse(raw || 'null')
    if (!session || typeof session !== 'object') return null
    if(!localStorage.getItem(TOKEN_KEY))persistSession(session)
    return session
  } catch {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
    return null
  }
}

function expiresAt(session) {
  if (Number(session?.expires_at)) return Number(session.expires_at)
  if (Number(session?.expires_in) && Number(session?.created_at)) return Number(session.created_at)+Number(session.expires_in)
  return 0
}

function isExpired(session) {
  const expiry=expiresAt(session)
  return expiry>0&&expiry<=Math.floor(Date.now()/1000)+EXPIRY_MARGIN_SECONDS
}

async function request(path,{method='GET',token='',body,headers:extra={}}={}){
  if(!supabaseEnabled)throw new Error('Supabase no está configurado')
  const response=await fetch(`${url}${path}`,{method,headers:{...headers(token),...extra},body:body===undefined?undefined:JSON.stringify(body)})
  const data=await response.json().catch(()=>null)
  if(!response.ok)throw new Error(data?.msg||data?.message||data?.error_description||data?.error||'Error de Supabase')
  return data
}

async function refreshSession(session) {
  if (!session?.refresh_token) return null
  try{
    const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}})
    persistSession(data)
    return data
  }catch{
    persistSession(null)
    return null
  }
}

export async function signIn(email,password){
  try{
    const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}})
    persistSession(data)
    return{data,error:null}
  }catch(error){return{data:null,error}}
}

export async function requestPasswordReset(email,redirectTo=window.location.origin+'/login'){
  return request('/auth/v1/recover',{method:'POST',body:{email,redirect_to:redirectTo}})
}

export async function signOut(){
  const session=loadSession()
  try{if(session?.access_token&&supabaseEnabled)await request('/auth/v1/logout',{method:'POST',token:session.access_token})}
  catch{ /* La sesión local debe cerrarse aunque falle la red. */ }
  finally{persistSession(null)}
}

export async function getSession(){
  const session=loadSession()
  if(!session)return{data:{session:null}}
  if(!isExpired(session))return{data:{session}}
  return{data:{session:await refreshSession(session)}}
}

export async function requireSession(){
  const{data}=await getSession()
  if(!data.session?.access_token||!data.session?.user?.id)throw new Error('Debes iniciar sesión')
  return data.session
}

export async function authenticatedRequest(path,options={}){
  const session=await requireSession()
  return request(path,{...options,token:session.access_token})
}

export async function loadRemoteIdentity(){
  const session=await requireSession()
  const userId=session.user.id
  const [profiles,memberships]=await Promise.all([
    request(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`,{token:session.access_token}),
    request(`/rest/v1/memberships?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=*,membership_sites(site_id)`,{token:session.access_token})
  ])
  return{user:session.user,profile:profiles?.[0]||null,memberships:memberships||[]}
}

export async function syncSnapshot(state){
  if(!supabaseEnabled)return{skipped:true}
  const session=await requireSession()
  return request('/rest/v1/erp_snapshots?on_conflict=user_id',{method:'POST',token:session.access_token,headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:{user_id:session.user.id,snapshot:state,updated_at:new Date().toISOString()}})
}
