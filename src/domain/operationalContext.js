import { explicitOrganizationId } from './organizationOwnership.js'
import { irrigationMirfeRecordOrganizationId } from './irrigationMirfeTenancy.js'
import { mipeRecordOrganizationId } from './mipeTenancy.js'

const list = value => Array.isArray(value) ? value : []
const text = value => String(value ?? '').trim()
const same = (a, b) => text(a) === text(b)
const terminalFinding = status => ['Resuelto', 'Falso positivo', 'Planta eliminada'].includes(text(status))

export const OPERATIONAL_CONTEXT_FIELDS = Object.freeze(['companyId', 'siteId', 'houseId', 'bedId', 'plantId'])

function activeUserId(state) {
  const activeUsers = list(state?.users).filter(item => item?.activeSession && item?.active !== false)
  if (activeUsers.length > 1) throw new Error('La sesión activa es ambigua; existen múltiples usuarios activos.')
  return text(activeUsers[0]?.id)
}

function activeMemberships(state) {
  const memberships = list(state?.memberships).filter(item => text(item?.status || 'active') === 'active')
  const userId = activeUserId(state)
  return userId ? memberships.filter(item => text(item?.userId) === userId) : memberships
}

function allowedCompanyIds(state) {
  const memberships = activeMemberships(state)
  return memberships.length
    ? new Set(memberships.map(item => text(item?.companyId || item?.organizationId)).filter(Boolean))
    : new Set(list(state?.companies).map(item => text(item?.id)).filter(Boolean))
}

function membershipSites(state, organizationId) {
  const all = activeMemberships(state)
  const memberships = all.filter(item => same(item?.companyId || item?.organizationId, organizationId))
  if (!all.length) return null
  if (!memberships.length) return new Set()
  if (memberships.some(item => list(item?.siteIds).length === 0)) return null
  return new Set(memberships.flatMap(item => list(item?.siteIds)).map(text).filter(Boolean))
}

function recordsForOrganization(state, collection, organizationId) {
  return list(state?.[collection]).filter(record => irrigationMirfeRecordOrganizationId(state, collection, record) === organizationId)
}

function uniqueById(records, id, label) {
  const key = text(id)
  if (!key) return null
  const matches = list(records).filter(item => same(item?.id, key))
  if (matches.length > 1) throw new Error(`${label} tiene identidad duplicada dentro de la empresa activa.`)
  return matches[0] || null
}

function companyFor(state, companyId) {
  const key = text(companyId)
  if (!key) return null
  const matches = list(state?.companies).filter(item => same(item?.id, key))
  if (matches.length > 1) throw new Error('La empresa activa tiene identidad duplicada.')
  return matches[0] || null
}

function organizationGenetics(state, organizationId) {
  return list(state?.genetics).filter(record => irrigationMirfeRecordOrganizationId(state, 'genetics', record) === organizationId)
}

export function operationalContextOptions(state, requested = state?.currentContext || {}) {
  const allowedCompanies = allowedCompanyIds(state)
  const companies = list(state?.companies).filter(item => allowedCompanies.has(text(item?.id)))
  const preferredCompany = text(requested?.companyId)
  const companyId = allowedCompanies.has(preferredCompany) && companyFor(state, preferredCompany)
    ? preferredCompany
    : text(companies[0]?.id)
  const siteRestriction = membershipSites(state, companyId)
  const sites = recordsForOrganization(state, 'sites', companyId)
    .filter(site => siteRestriction === null || siteRestriction.has(text(site?.id)))
  const siteId = text(requested?.siteId)
  const site = uniqueById(sites, siteId, 'La sede activa')
  const houses = site
    ? recordsForOrganization(state, 'houses', companyId).filter(item => same(item?.siteId, site.id))
    : []
  const house = uniqueById(houses, requested?.houseId, 'La nave activa')
  const beds = house
    ? recordsForOrganization(state, 'beds', companyId).filter(item => same(item?.houseId, house.id))
    : []
  const bed = uniqueById(beds, requested?.bedId, 'La cama activa')
  const plants = bed
    ? recordsForOrganization(state, 'plantPositions', companyId).filter(item => same(item?.bedId, bed.id))
    : []
  const plant = uniqueById(plants, requested?.plantId, 'La planta activa')
  const genetics = organizationGenetics(state, companyId)
  return Object.freeze({
    companyId,
    companies: Object.freeze(companies),
    sites: Object.freeze(sites),
    houses: Object.freeze(houses),
    beds: Object.freeze(beds),
    plants: Object.freeze(plants),
    genetics: Object.freeze(genetics),
    selected: Object.freeze({ company: companyFor(state, companyId), site, house, bed, plant })
  })
}

export function normalizeOperationalContext(state, requested = state?.currentContext || {}) {
  const options = operationalContextOptions(state, requested)
  const current = requested || {}
  const companyId = options.companyId
  const siteId = options.selected.site ? text(options.selected.site.id) : ''
  const houseId = siteId && options.selected.house ? text(options.selected.house.id) : ''
  const bedId = houseId && options.selected.bed ? text(options.selected.bed.id) : ''
  const plantId = bedId && options.selected.plant ? text(options.selected.plant.id) : ''
  const geneticId = uniqueById(options.genetics, current.geneticId, 'La genética activa') ? text(current.geneticId) : ''
  const week = Math.max(1, Math.trunc(Number(current.week) || 1))
  return Object.freeze({
    ...current,
    companyId,
    siteId,
    houseId,
    bedId,
    plantId,
    geneticId,
    stage: text(current.stage),
    week,
    cycleId: text(current.cycleId)
  })
}

export function transitionOperationalContext(state, patch = {}) {
  const current = { ...(state?.currentContext || {}) }
  const next = { ...current, ...patch }
  if (Object.hasOwn(patch, 'companyId') && !same(patch.companyId, current.companyId)) {
    Object.assign(next, { siteId: '', houseId: '', bedId: '', plantId: '', geneticId: '' })
  }
  if (Object.hasOwn(patch, 'siteId') && !same(patch.siteId, current.siteId)) {
    Object.assign(next, { houseId: '', bedId: '', plantId: '' })
  }
  if (Object.hasOwn(patch, 'houseId') && !same(patch.houseId, current.houseId)) {
    Object.assign(next, { bedId: '', plantId: '' })
  }
  if (Object.hasOwn(patch, 'bedId') && !same(patch.bedId, current.bedId)) next.plantId = ''
  return normalizeOperationalContext(state, next)
}

export function operationalContextForPlant(state, plantId, { companyId = state?.currentContext?.companyId || '' } = {}) {
  const base = normalizeOperationalContext(state, {
    ...(state?.currentContext || {}),
    companyId,
    siteId: '',
    houseId: '',
    bedId: '',
    plantId: ''
  })
  const organizationId = base.companyId
  const plants = recordsForOrganization(state, 'plantPositions', organizationId)
  const plant = uniqueById(plants, plantId, 'La planta seleccionada')
  if (!plant) throw new Error('No se encontró la planta seleccionada en la empresa activa.')
  const bed = uniqueById(recordsForOrganization(state, 'beds', organizationId), plant.bedId, 'La cama de la planta')
  if (!bed) throw new Error('La planta no tiene una cama canónica dentro de la empresa activa.')
  const house = uniqueById(recordsForOrganization(state, 'houses', organizationId), bed.houseId, 'La nave de la planta')
  if (!house) throw new Error('La cama no tiene una nave canónica dentro de la empresa activa.')
  const options = operationalContextOptions(state, { ...base, siteId: house.siteId })
  const site = uniqueById(options.sites, house.siteId, 'La sede de la planta')
  if (!site) throw new Error('La planta pertenece a una sede fuera del alcance operativo del usuario.')
  return normalizeOperationalContext(state, {
    ...base,
    siteId: site.id,
    houseId: house.id,
    bedId: bed.id,
    plantId: plant.id
  })
}

function directRecordBelongs(state, record, organizationId, allowedSiteIds) {
  const owner = explicitOrganizationId(record)
  if (owner && owner !== organizationId) return false
  const siteId = text(record?.siteId)
  if (siteId) return allowedSiteIds.has(siteId)
  if (owner) return true
  return list(state?.companies).length <= 1
}

function scopeDirect(state, key, organizationId, allowedSiteIds) {
  return list(state?.[key]).filter(record => directRecordBelongs(state, record, organizationId, allowedSiteIds))
}

function operationalRecordMatchesScope(state, record, organizationId, { siteIds, houseIds, bedIds, plantIds }) {
  const plantId = text(record?.plantPositionId || record?.plantId)
  if (plantId) {
    const plant = uniqueById(recordsForOrganization(state, 'plantPositions', organizationId), plantId, 'La planta del registro contextual')
    return Boolean(plant) && plantIds.has(text(plant.id))
  }

  const bedId = text(record?.bedId)
  if (bedId) {
    const bed = uniqueById(recordsForOrganization(state, 'beds', organizationId), bedId, 'La cama del registro contextual')
    return Boolean(bed) && bedIds.has(text(bed.id))
  }

  const houseId = text(record?.houseId)
  if (houseId) {
    const house = uniqueById(recordsForOrganization(state, 'houses', organizationId), houseId, 'La nave del registro contextual')
    return Boolean(house) && houseIds.has(text(house.id))
  }

  const siteId = text(record?.siteId)
  if (siteId) {
    const site = uniqueById(recordsForOrganization(state, 'sites', organizationId), siteId, 'La sede del registro contextual')
    return Boolean(site) && siteIds.has(text(site.id))
  }

  return true
}

export function scopeOperationalState(state, requested = state?.currentContext || {}) {
  const context = normalizeOperationalContext(state, requested)
  const organizationId = context.companyId
  const options = operationalContextOptions(state, context)
  if (!organizationId) return { ...state, currentContext: context }

  const siteRestriction = membershipSites(state, organizationId)
  const allSites = options.sites
  const siteIds = new Set((context.siteId
    ? allSites.filter(item => same(item.id, context.siteId))
    : allSites).map(item => text(item.id)))

  const allHouses = recordsForOrganization(state, 'houses', organizationId)
    .filter(item => siteIds.has(text(item?.siteId)))
  const houses = context.houseId ? allHouses.filter(item => same(item.id, context.houseId)) : allHouses
  const houseIds = new Set(houses.map(item => text(item.id)))

  const allBeds = recordsForOrganization(state, 'beds', organizationId)
    .filter(item => houseIds.has(text(item?.houseId)))
  const beds = context.bedId ? allBeds.filter(item => same(item.id, context.bedId)) : allBeds
  const bedIds = new Set(beds.map(item => text(item.id)))

  const allPlants = recordsForOrganization(state, 'plantPositions', organizationId)
    .filter(item => bedIds.has(text(item?.bedId)))
  const plantPositions = context.plantId ? allPlants.filter(item => same(item.id, context.plantId)) : allPlants
  const plantIds = new Set(plantPositions.map(item => text(item.id)))
  const sites = allSites.filter(item => siteIds.has(text(item.id)))

  const tenantFindings = list(state?.findings)
    .filter(record => mipeRecordOrganizationId(state, 'findings', record) === organizationId)
  const findings = tenantFindings.filter(finding => {
    const positionId = text(finding?.plantPositionId)
      || (text(finding?.targetType) === 'POSITION' ? text(finding?.targetId) : '')
    if (positionId) return plantIds.has(positionId)
    if (context.houseId || context.bedId || context.plantId) return false
    if (finding?.siteId) return siteIds.has(text(finding.siteId))
    return !context.siteId && siteRestriction === null
  })

  const findingIds = new Set(findings.map(item => text(item.id)))
  const treatments = list(state?.treatments).filter(record =>
    mipeRecordOrganizationId(state, 'treatments', record) === organizationId
    && findingIds.has(text(record?.findingId))
  )
  const mipeInterventions = list(state?.mipeInterventions).filter(record =>
    mipeRecordOrganizationId(state, 'mipeInterventions', record) === organizationId
    && findingIds.has(text(record?.findingId))
  )
  const incidents = list(state?.incidents)
    .filter(record => mipeRecordOrganizationId(state, 'incidents', record) === organizationId)

  const allAuthorizedSiteIds = new Set(allSites.map(item => text(item.id)))
  const hierarchyScope = { siteIds, houseIds, bedIds, plantIds }
  const scoped = {
    ...state,
    currentContext: context,
    sites,
    houses,
    beds,
    plantPositions,
    findings,
    treatments,
    mipeInterventions,
    incidents
  }

  for (const key of ['propagationBanks', 'propagationUnits', 'genetics', 'products', 'inventoryLots', 'inventoryMovements', 'workOrders', 'costEntries']) {
    if (Array.isArray(state?.[key])) {
      scoped[key] = recordsForOrganization(state, key, organizationId)
        .filter(record => operationalRecordMatchesScope(state, record, organizationId, hierarchyScope))
    }
  }

  for (const key of ['grandmotherPlants', 'motherPlants']) {
    if (Array.isArray(state?.[key])) {
      scoped[key] = list(state[key])
        .filter(record => mipeRecordOrganizationId(state, key, record) === organizationId)
        .filter(record => operationalRecordMatchesScope(state, record, organizationId, hierarchyScope))
    }
  }

  for (const key of ['propagationBatches', 'mapElements', 'facilityAreas', 'operationalAreas', 'finishedGoods', 'finishedGoodsMovements', 'sales', 'customers', 'phaseTransitions', 'plantEvents']) {
    if (Array.isArray(state?.[key])) {
      scoped[key] = scopeDirect(state, key, organizationId, allAuthorizedSiteIds)
        .filter(record => operationalRecordMatchesScope(state, record, organizationId, hierarchyScope))
    }
  }

  return scoped
}

export function contextualFindingIsOpen(finding) {
  return !terminalFinding(finding?.status)
}
