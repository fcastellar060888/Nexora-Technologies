const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseEnabled = Boolean(url && anonKey)
const TOKEN_KEY = 'cannapa_supabase_session'

function headers(token='') {
  return {
    apikey: anonKey || '',
    Authorization: `Bearer ${token || anonKey || ''}`,
    'Content-Type': 'application/json',
  }
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null') }
  catch { return null }
}

export async function signIn(email, password) {
  if (!supabaseEnabled) throw new Error('Supabase no está configurado')
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json()
  if (!response.ok) return { error: new Error(data.msg || data.error_description || 'No fue posible iniciar sesión') }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(data))
  return { data, error: null }
}

export async function signOut() {
  const session = loadSession()
  if (session?.access_token && supabaseEnabled) {
    await fetch(`${url}/auth/v1/logout`, { method:'POST', headers:headers(session.access_token) })
  }
  localStorage.removeItem(TOKEN_KEY)
}

export async function getSession() {
  return { data: { session: loadSession() } }
}

export async function syncSnapshot(state) {
  if (!supabaseEnabled) return { skipped: true }
  const session = loadSession()
  if (!session?.access_token || !session?.user?.id) throw new Error('Debes iniciar sesión')
  const response = await fetch(`${url}/rest/v1/erp_snapshots?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      ...headers(session.access_token),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      user_id: session.user.id,
      snapshot: state,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!response.ok) {
    const data = await response.json().catch(()=>({}))
    throw new Error(data.message || 'No fue posible sincronizar')
  }
  return response.json()
}
