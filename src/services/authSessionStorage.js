export const AUTH_SESSION_KEY = 'nexora_supabase_session'
export const LEGACY_AUTH_KEYS = ['canapa_supabase_session', 'cannapa_supabase_session']
export const AUTH_CHANNEL_NAME = 'nexora-auth'

function safeRemove(storage, key) {
  try { storage?.removeItem?.(key) } catch { /* Storage can be unavailable in hardened browsers. */ }
}

function safeRead(storage, key) {
  try { return storage?.getItem?.(key) || '' } catch { return '' }
}

function safeWrite(storage, key, value) {
  try {
    storage?.setItem?.(key, value)
    return true
  } catch { return false }
}

export function createAuthSessionStorage({
  sessionStorageRef = globalThis.sessionStorage,
  localStorageRef = globalThis.localStorage,
  broadcastChannelFactory = name => typeof globalThis.BroadcastChannel === 'function' ? new globalThis.BroadcastChannel(name) : null,
} = {}) {
  let memorySession = null
  let channel = null
  const listeners = new Set()

  const removeLegacyLocalSessions = () => {
    safeRemove(localStorageRef, AUTH_SESSION_KEY)
    for (const key of LEGACY_AUTH_KEYS) safeRemove(localStorageRef, key)
  }

  const notify = (event, session = null) => {
    for (const listener of [...listeners]) {
      try { listener({ event, session }) } catch { /* Auth observers must not break session cleanup. */ }
    }
  }

  const ensureChannel = () => {
    if (channel) return channel
    try {
      channel = broadcastChannelFactory(AUTH_CHANNEL_NAME)
      if (channel) {
        channel.onmessage = message => {
          if (message?.data?.type !== 'SIGNED_OUT') return
          memorySession = null
          safeRemove(sessionStorageRef, AUTH_SESSION_KEY)
          removeLegacyLocalSessions()
          notify('SIGNED_OUT', null)
        }
      }
    } catch { channel = null }
    return channel
  }

  const save = session => {
    removeLegacyLocalSessions()
    if (!session) {
      memorySession = null
      safeRemove(sessionStorageRef, AUTH_SESSION_KEY)
      notify('SIGNED_OUT', null)
      return null
    }
    const serialized = JSON.stringify(session)
    memorySession = session
    if (!safeWrite(sessionStorageRef, AUTH_SESSION_KEY, serialized)) {
      // Memory-only fallback is deliberate: never fall back to localStorage for auth tokens.
    }
    notify('SESSION_UPDATED', session)
    return session
  }

  const load = () => {
    removeLegacyLocalSessions()
    if (memorySession) return memorySession
    const raw = safeRead(sessionStorageRef, AUTH_SESSION_KEY)
    if (!raw) return null
    try {
      const session = JSON.parse(raw)
      if (!session || typeof session !== 'object') throw new Error('invalid session')
      memorySession = session
      return session
    } catch {
      safeRemove(sessionStorageRef, AUTH_SESSION_KEY)
      return null
    }
  }

  const clear = ({ broadcast = false } = {}) => {
    memorySession = null
    safeRemove(sessionStorageRef, AUTH_SESSION_KEY)
    removeLegacyLocalSessions()
    notify('SIGNED_OUT', null)
    if (broadcast) {
      try { ensureChannel()?.postMessage?.({ type: 'SIGNED_OUT' }) } catch { /* Local logout still succeeds. */ }
    }
  }

  const subscribe = listener => {
    if (typeof listener !== 'function') return () => {}
    listeners.add(listener)
    ensureChannel()
    return () => listeners.delete(listener)
  }

  const close = () => {
    listeners.clear()
    try { channel?.close?.() } catch { /* no-op */ }
    channel = null
  }

  removeLegacyLocalSessions()
  if (typeof globalThis.window !== 'undefined') ensureChannel()

  return { save, load, clear, subscribe, close, removeLegacyLocalSessions }
}
