const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseEnabled = Boolean(url && anonKey)
const TOKEN_KEY = 'cannapa_supabase_session'
const EXPIRY_MARGIN_SECONDS = 60

function headers(token='') {
  return {
    apikey: anonKey || '',
    Authorization: `Bearer ${token || anonKey || ''}`,
    'Content-Type': 'application/json',
  }
}

function persistSession(session) {
  if (!session) localStorage.removeItem(TOKEN_KEY)
  else localStorage.setItem(TOKEN_KEY, JSON.stringify(session))
}

function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')
    if (!session || typeof session !== 'object') return null
    return session
  } catch {
    localStorage.removeItem(TOKEN_KEY)
    return null
  }
}

function expiresAt(session) {
  if (Number(session?.expires_at)) return Number(session.expires_at)
  if (Number(session?.expires_in) && Number(session?.created_at)) {
    return Number(session.created_at) + Number(session.expires_in)
  }
  return 0
}

function isExpired(session) {
  const expiry = expiresAt(session)
  if (!expiry) return false
  return expiry <= Math.floor(Date.now() / 1000) + EXPIRY_MARGIN_SECONDS
}

async function refreshSession(session) {
  if (!supabaseEnabled || !session?.refresh_token) return null
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.access_token) {
    persistSession(null)
    return null
  }
  persistSession(data)
  return data
}

export async function signIn(email, password) {
  if (!supabaseEnabled) throw new Error('Supabase no está configurado')
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { error: new Error(data.msg || data.error_description || 'No fue posible iniciar sesión') }
  }
  persistSession(data)
  return { data, error: null }
}

export async function signOut() {
  const session = loadSession()
  try {
    if (session?.access_token && supabaseEnabled) {
      await fetch(`${url}/auth/v1/logout`, {
        method: 'POST',
        headers: headers(session.access_token),
      })
    }
  } finally {
    persistSession(null)
  }
}

export async function getSession() {
  const session = loadSession()
  if (!session) return { data: { session: null } }
  if (!isExpired(session)) return { data: { session } }
  const refreshed = await refreshSession(session)
  return { data: { session: refreshed } }
}

async function requireSession() {
  const { data } = await getSession()
  const session = data.session
  if (!session?.access_token || !session?.user?.id) throw new Error('Debes iniciar sesión')
  return session
}

export async function syncSnapshot(state) {
  if (!supabaseEnabled) return { skipped: true }
  const session = await requireSession()
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
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || 'No fue posible sincronizar')
  }
  return response.json()
}
