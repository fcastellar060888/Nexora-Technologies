import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { DomainEvents, isKnownDomainEvent } from '../src/core/events/index.js'

const readSource = async relative => readFile(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8')

test('M1.1-B: catálogo expone ciclo de vida no destructivo para área y nave', () => {
  const expected = {
    FACILITY_AREA_CREATED: 'facility.area.created',
    FACILITY_AREA_UPDATED: 'facility.area.updated',
    FACILITY_AREA_ARCHIVED: 'facility.area.archived',
    FACILITY_HOUSE_CREATED: 'facility.house.created',
    FACILITY_HOUSE_UPDATED: 'facility.house.updated',
    FACILITY_HOUSE_ARCHIVED: 'facility.house.archived'
  }
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(DomainEvents[key], value)
    assert.equal(isKnownDomainEvent(value), true)
  }
})

test('M1.1-B: FacilityAreaManager archiva por command boundary y nunca elimina físicamente áreas', async () => {
  const source = await readSource('src/components/FacilityAreaManager.jsx')
  assert.match(source, /activeSites=.*filter\(site=>site\.active!==false\)/)
  assert.match(source, /executeCoreOperationCommand/)
  assert.match(source, /FACILITY_AREA_CREATED/)
  assert.match(source, /FACILITY_AREA_UPDATED/)
  assert.match(source, /FACILITY_AREA_ARCHIVED/)
  assert.match(source, /apply:store=>\(\{\.\.\.store,facilityAreas:\(store\.facilityAreas\|\|\[\]\)\.map\(item=>item\.id===area\.id\?after:item\)\}\)/)
  assert.match(source, /active:false,archivedAt/)
  assert.match(source, /item\.areaId===area\.id&&item\.active!==false/)
  assert.match(source, /organizationId/)
  assert.doesNotMatch(source, /facilityAreas:areas\.filter\(item=>item\.id!==area\.id\)/)
})

test('M1.1-B: HousesPage archiva por command boundary sin cascada destructiva', async () => {
  const source = await readSource('src/pages/HousesPage.jsx')
  assert.match(source, /activeSites=state\.sites\.filter\(site=>site\.active!==false\)/)
  assert.match(source, /executeCoreOperationCommand/)
  assert.match(source, /FACILITY_HOUSE_CREATED/)
  assert.match(source, /FACILITY_HOUSE_UPDATED/)
  assert.match(source, /FACILITY_HOUSE_ARCHIVED/)
  assert.match(source, /apply:store=>\(\{\.\.\.store,houses:store\.houses\.map\(x=>x\.id===h\.id\?after:x\)\}\)/)
  assert.match(source, /activeBeds=state\.beds\.filter\(b=>b\.houseId===h\.id&&b\.active!==false\)/)
  assert.match(source, /active:false,archivedAt/)
  assert.match(source, /organizationId/)
  assert.doesNotMatch(source, /houses:store\.houses\.filter\(x=>x\.id!==/)
  assert.doesNotMatch(source, /beds:store\.beds\.filter\(b=>b\.houseId!==/)
  assert.doesNotMatch(source, /findings:store\.findings\.filter\(/)
})
