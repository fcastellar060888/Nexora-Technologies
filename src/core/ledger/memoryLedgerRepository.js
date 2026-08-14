import { createLedgerEntry, isLedgerEntry } from './ledgerEntry.js'

const text = value => String(value || '').toLocaleLowerCase('es')
const errorText = error => String(error?.message || error || 'Error de listener no identificado')
const fingerprint = event => JSON.stringify(event)

export function createMemoryLedgerRepository({
  maxEntries = 10000,
  maxKnownEntries = 100000,
  errorHistoryLimit = 100,
  onListenerError = null
} = {}) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error('El límite del Ledger debe ser un entero positivo')
  if (!Number.isInteger(maxKnownEntries) || maxKnownEntries < maxEntries) throw new Error('La capacidad de identidad histórica debe ser un entero igual o mayor al límite del Ledger')
  if (!Number.isInteger(errorHistoryLimit) || errorHistoryLimit < 1) throw new Error('El límite de errores del Ledger debe ser un entero positivo')
  if (onListenerError !== null && typeof onListenerError !== 'function') throw new Error('onListenerError debe ser una función')

  const entries = []
  const entriesById = new Map()
  const entriesBySequence = new Map()
  const knownEntriesById = new Map()
  const knownEntriesBySequence = new Map()
  const listeners = new Set()
  const listenerErrors = []
  const activeListenerTasks = new Set()
  let nextSequence = 1
  let listenerFailureCount = 0

  function assertSameIdentity(existing, event) {
    if (fingerprint(existing.event) !== fingerprint(event)) {
      throw new Error(`El eventId ${event?.eventId || ''} ya pertenece a un evento diferente`)
    }
  }

  function assertKnownCapacity(additional = 1) {
    if (knownEntriesById.size + additional > maxKnownEntries) {
      throw new Error(`La capacidad de identidad histórica del Ledger (${maxKnownEntries}) fue alcanzada`)
    }
  }

  function assertIdle(action) {
    if (activeListenerTasks.size) {
      throw new Error(`No se puede ${action} el Ledger mientras existen observadores asíncronos activos`)
    }
  }

  function reportListenerError(error, entry) {
    listenerFailureCount += 1
    const failure = Object.freeze({
      id: `ledger-listener-error:${listenerFailureCount}`,
      entryId: entry.id,
      sequence: entry.sequence,
      occurredAt: new Date().toISOString(),
      message: errorText(error)
    })
    listenerErrors.push(failure)
    if (listenerErrors.length > errorHistoryLimit) listenerErrors.splice(0, listenerErrors.length - errorHistoryLimit)
    if (onListenerError) {
      try { onListenerError(error, entry, failure) } catch { /* La telemetría tampoco bloquea el Ledger. */ }
    }
  }

  function trackListenerResult(result, entry) {
    if (!result || typeof result.then !== 'function') return
    let task
    task = Promise.resolve(result)
      .catch(error => reportListenerError(error, entry))
      .finally(() => activeListenerTasks.delete(task))
    activeListenerTasks.add(task)
  }

  function notify(entry) {
    listeners.forEach(listener => {
      try {
        trackListenerResult(listener(entry), entry)
      } catch (error) {
        reportListenerError(error, entry)
      }
    })
  }

  function rebuildRetainedIndexes() {
    entriesById.clear()
    entriesBySequence.clear()
    entries.forEach(entry => {
      entriesById.set(entry.id, entry)
      entriesBySequence.set(entry.sequence, entry)
    })
  }

  function trim() {
    if (entries.length <= maxEntries) return
    entries.splice(0, entries.length - maxEntries)
    rebuildRetainedIndexes()
  }

  function append(event, options = {}) {
    const existing = knownEntriesById.get(event?.eventId)
    if (existing) {
      assertSameIdentity(existing, event)
      return existing
    }

    assertKnownCapacity()
    const sequence = options.sequence ?? nextSequence
    const sequenceOwner = knownEntriesBySequence.get(sequence)
    if (sequenceOwner) throw new Error(`La secuencia ${sequence} ya pertenece al evento ${sequenceOwner.id}`)

    const entry = createLedgerEntry(event, { ...options, sequence })
    entries.push(entry)
    entries.sort((a, b) => a.sequence - b.sequence)
    knownEntriesById.set(entry.id, entry)
    knownEntriesBySequence.set(entry.sequence, entry)
    rebuildRetainedIndexes()
    nextSequence = Math.max(nextSequence, entry.sequence + 1)
    trim()
    notify(entry)
    return entry
  }

  function prepareMany(values, mode) {
    if (!Array.isArray(values)) throw new Error(mode === 'append' ? 'La escritura por lote del Ledger requiere una lista' : 'La reconciliación del Ledger requiere una lista')
    const candidateById = new Map(knownEntriesById)
    const candidateBySequence = new Map(knownEntriesBySequence)
    const prepared = []
    const results = []
    let candidateNextSequence = nextSequence

    for (const value of values) {
      const event = isLedgerEntry(value) ? value.event : value
      const options = isLedgerEntry(value) ? { sequence: value.sequence, recordedAt: value.recordedAt } : {}
      const existing = candidateById.get(event?.eventId)
      if (existing) {
        assertSameIdentity(existing, event)
        if (mode === 'append') results.push(existing)
        continue
      }
      if (candidateById.size + 1 > maxKnownEntries) throw new Error(`La capacidad de identidad histórica del Ledger (${maxKnownEntries}) fue alcanzada`)
      const sequence = options.sequence ?? candidateNextSequence
      const sequenceOwner = candidateBySequence.get(sequence)
      if (sequenceOwner) throw new Error(`La secuencia ${sequence} ya pertenece al evento ${sequenceOwner.id}`)
      const entry = createLedgerEntry(event, { ...options, sequence })
      prepared.push(entry)
      if (mode === 'append') results.push(entry)
      candidateById.set(entry.id, entry)
      candidateBySequence.set(entry.sequence, entry)
      candidateNextSequence = Math.max(candidateNextSequence, entry.sequence + 1)
    }
    return { prepared, results, candidateNextSequence }
  }

  function commitPrepared(prepared, candidateNextSequence, notifyEntries) {
    if (!prepared.length) return
    entries.push(...prepared)
    entries.sort((a, b) => a.sequence - b.sequence)
    prepared.forEach(entry => {
      knownEntriesById.set(entry.id, entry)
      knownEntriesBySequence.set(entry.sequence, entry)
    })
    nextSequence = candidateNextSequence
    rebuildRetainedIndexes()
    trim()
    if (notifyEntries) prepared.forEach(notify)
  }

  function appendMany(values = []) {
    const { prepared, results, candidateNextSequence } = prepareMany(values, 'append')
    commitPrepared(prepared, candidateNextSequence, true)
    return results
  }

  function reconcileMany(values = []) {
    const { prepared, candidateNextSequence } = prepareMany(values, 'reconcile')
    commitPrepared(prepared, candidateNextSequence, false)
    return entries.slice()
  }

  function replaceMany(values = [], { authoritative = false } = {}) {
    if (!Array.isArray(values)) throw new Error('La rehidratación del Ledger requiere una lista')
    if (typeof authoritative !== 'boolean') throw new Error('authoritative debe ser booleano')
    const prepared = []
    const preparedById = new Map()
    const preparedBySequence = new Map()
    let preparedNextSequence = 1

    for (const value of values) {
      const event = isLedgerEntry(value) ? value.event : value
      const options = isLedgerEntry(value) ? { sequence: value.sequence, recordedAt: value.recordedAt } : {}
      const known = knownEntriesById.get(event?.eventId)
      if (known) {
        assertSameIdentity(known, event)
        if (options.sequence !== undefined && options.sequence !== known.sequence) {
          throw new Error(`El eventId ${event.eventId} no puede cambiar de secuencia histórica`)
        }
      }
      const existing = preparedById.get(event?.eventId)
      if (existing) {
        assertSameIdentity(existing, event)
        continue
      }
      if (preparedById.size + 1 > maxKnownEntries) throw new Error(`La capacidad de identidad histórica del Ledger (${maxKnownEntries}) fue alcanzada`)
      const sequence = options.sequence ?? preparedNextSequence
      const sequenceOwner = preparedBySequence.get(sequence)
      if (sequenceOwner) throw new Error(`La secuencia ${sequence} ya pertenece al evento ${sequenceOwner.id}`)
      const entry = createLedgerEntry(event, { ...options, sequence })
      prepared.push(entry)
      preparedById.set(entry.id, entry)
      preparedBySequence.set(entry.sequence, entry)
      preparedNextSequence = Math.max(preparedNextSequence, entry.sequence + 1)
    }

    const omittedKnownEntries = [...knownEntriesById.keys()].filter(id => !preparedById.has(id))
    if (omittedKnownEntries.length && !authoritative) {
      throw new Error(`El reemplazo omite ${omittedKnownEntries.length} identidades conocidas; use authoritative: true solo con un snapshot completo`)
    }

    assertIdle('rehidratar')
    prepared.sort((a, b) => a.sequence - b.sequence)
    const retained = prepared.slice(-maxEntries)
    entries.length = 0
    entries.push(...retained)
    knownEntriesById.clear()
    knownEntriesBySequence.clear()
    prepared.forEach(entry => {
      knownEntriesById.set(entry.id, entry)
      knownEntriesBySequence.set(entry.sequence, entry)
    })
    rebuildRetainedIndexes()
    nextSequence = Math.max(1, preparedNextSequence)
    return retained.slice()
  }

  function compactKnownEntries({ remove = [] } = {}) {
    assertIdle('compactar')
    if (!Array.isArray(remove)) throw new Error('La compactación de identidad histórica requiere una lista')
    const retainedIds = new Set(entries.map(entry => entry.id))
    let removed = 0
    for (const id of new Set(remove)) {
      if (retainedIds.has(id)) throw new Error(`No se puede compactar la identidad retenida ${id}`)
      const entry = knownEntriesById.get(id)
      if (!entry) continue
      knownEntriesById.delete(id)
      knownEntriesBySequence.delete(entry.sequence)
      removed += 1
    }
    return Object.freeze({ removed, knownEntries: knownEntriesById.size })
  }

  function find({ organizationId, siteId, eventName, aggregateType, aggregateId, actorId, correlationId, from, to, search, order = 'desc', limit = 100 } = {}) {
    const fromTime = from ? Date.parse(from) : null
    const toTime = to ? Date.parse(to) : null
    const needle = text(search)
    return entries.filter(entry => {
      const event = entry.event
      const time = Date.parse(event.occurredAt)
      return (!organizationId || event.context.organizationId === organizationId) &&
        (!siteId || event.context.siteId === siteId) &&
        (!eventName || event.name === eventName) &&
        (!aggregateType || event.aggregate.type === aggregateType) &&
        (!aggregateId || event.aggregate.id === aggregateId) &&
        (!actorId || event.context.actorId === actorId) &&
        (!correlationId || event.correlationId === correlationId) &&
        (fromTime === null || time >= fromTime) &&
        (toTime === null || time <= toTime) &&
        (!needle || [event.name, event.aggregate.type, event.aggregate.id, event.metadata?.actorName, event.payload?.label, event.payload?.summary].some(value => text(value).includes(needle)))
    }).sort((a, b) => (order === 'asc' ? 1 : -1) * (a.sequence - b.sequence)).slice(0, Math.max(0, limit))
  }

  function getByEventId(id) { return entriesById.get(id) || null }
  function getBySequence(sequence) { return entriesBySequence.get(sequence) || null }
  function count(filters = {}) { return find({ ...filters, limit: Number.MAX_SAFE_INTEGER }).length }
  function subscribe(listener) {
    if (typeof listener !== 'function') throw new Error('El observador del Ledger debe ser una función')
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  function getListenerErrors({ limit = errorHistoryLimit } = {}) {
    return Object.freeze(listenerErrors.slice(-Math.max(0, Number(limit) || 0)))
  }
  function clearListenerErrors() { listenerErrors.length = 0; return true }
  function clear() {
    assertIdle('limpiar')
    entries.length = 0
    entriesById.clear()
    entriesBySequence.clear()
    knownEntriesById.clear()
    knownEntriesBySequence.clear()
    nextSequence = 1
  }
  function health() {
    const lastListenerError = listenerErrors.at(-1) || null
    return Object.freeze({
      status: listenerErrors.length ? 'degraded' : 'ready',
      driver: 'memory',
      entries: entries.length,
      knownEntries: knownEntriesById.size,
      maxKnownEntries,
      remainingKnownCapacity: maxKnownEntries - knownEntriesById.size,
      activeListeners: activeListenerTasks.size,
      nextSequence,
      maxEntries,
      listenerFailureCount,
      listenerErrorsRetained: listenerErrors.length,
      lastListenerError
    })
  }

  return Object.freeze({
    append,
    appendMany,
    reconcileMany,
    replaceMany,
    compactKnownEntries,
    find,
    getByEventId,
    getBySequence,
    count,
    subscribe,
    getListenerErrors,
    clearListenerErrors,
    clear,
    health
  })
}

const scopedLedgers = new Map()
function scopePart(value, label) {
  const normalized = String(value ?? '').trim()
  if (!normalized) throw new Error(`${label} es obligatorio para resolver el runtime`)
  return normalized
}
export function ledgerRuntimeKey({ organizationId } = {}) {
  return scopePart(organizationId, 'La empresa')
}
export function getOperationalLedgerForScope(scope) {
  const key = ledgerRuntimeKey(scope)
  if (!scopedLedgers.has(key)) scopedLedgers.set(key, createMemoryLedgerRepository())
  return scopedLedgers.get(key)
}
export function releaseOperationalLedgerScope(scope) {
  const key = ledgerRuntimeKey(scope)
  const ledger = scopedLedgers.get(key)
  if (!ledger) return false
  ledger.clear()
  scopedLedgers.delete(key)
  return true
}
export function operationalLedgerScopeCount() { return scopedLedgers.size }

export const operationalLedger = getOperationalLedgerForScope({ organizationId: 'local-installation' })