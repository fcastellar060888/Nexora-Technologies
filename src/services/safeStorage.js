import { initialState, loadState as legacyLoadState, saveState as legacySaveState } from './storage'

const DATA_KEY = 'cannapa_erp_v1_foundation'
const BACKUP_KEY = `${DATA_KEY}_backup`
const CORRUPT_KEY = `${DATA_KEY}_corrupt`
const SCHEMA_VERSION = 2

function cloneInitialState() {
  return structuredClone(initialState)
}

function preserveRaw(key, raw, reason) {
  if (!raw) return
  localStorage.setItem(key, JSON.stringify({
    preservedAt: new Date().toISOString(),
    reason,
    raw,
  }))
}

export function loadState() {
  const raw = localStorage.getItem(DATA_KEY)
  if (!raw) return cloneInitialState()

  try {
    JSON.parse(raw)
  } catch (error) {
    preserveRaw(CORRUPT_KEY, raw, error instanceof Error ? error.message : 'JSON inválido')
    console.error('No fue posible leer el estado local. Se preservó una copia para recuperación.', error)
    return cloneInitialState()
  }

  preserveRaw(BACKUP_KEY, raw, 'Copia previa a normalización/migración')

  try {
    const state = legacyLoadState()
    return {
      ...state,
      schemaVersion: SCHEMA_VERSION,
    }
  } catch (error) {
    console.error('Falló la normalización del estado local. Se usará la copia original sin sobrescribirla.', error)
    const parsed = JSON.parse(raw)
    return {
      ...cloneInitialState(),
      ...parsed,
      schemaVersion: Number(parsed.schemaVersion || 1),
    }
  }
}

export function saveState(state) {
  try {
    legacySaveState({
      ...state,
      schemaVersion: SCHEMA_VERSION,
      persistedAt: new Date().toISOString(),
    })
    return { ok: true }
  } catch (error) {
    console.error('No fue posible guardar el estado local.', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido de almacenamiento',
    }
  }
}

export function getRecoverySnapshot() {
  for (const key of [CORRUPT_KEY, BACKUP_KEY]) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null')
      if (value) return { key, ...value }
    } catch {
      // Sigue intentando con la siguiente copia disponible.
    }
  }
  return null
}
