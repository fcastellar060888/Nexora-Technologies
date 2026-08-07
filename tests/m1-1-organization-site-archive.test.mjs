import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { DomainEvents, isKnownDomainEvent } from '../src/core/events/index.js'

const readSource = async relative => readFile(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8')

test('M1.1-A: catálogo usa archivado y no borrado destructivo para empresa y sede', () => {
  assert.equal(DomainEvents.COMPANY_ARCHIVED, 'organization.company.archived')
  assert.equal(DomainEvents.SITE_ARCHIVED, 'organization.site.archived')
  assert.equal(isKnownDomainEvent(DomainEvents.COMPANY_ARCHIVED), true)
  assert.equal(isKnownDomainEvent(DomainEvents.SITE_ARCHIVED), true)
  assert.equal('COMPANY_DELETED' in DomainEvents, false)
  assert.equal('SITE_DELETED' in DomainEvents, false)
})

test('M1.1-A: CompaniesPage preserva identidad, historial y bloquea solo dependencias activas', async () => {
  const source = await readSource('src/pages/CompaniesPage.jsx')
  assert.match(source, /state\.sites\.filter\(site=>site\.active!==false\)/)
  assert.match(source, /companies:store\.companies\.map\(item=>item\.id===company\.id\?after:item\)/)
  assert.match(source, /active:false,archivedAt/)
  assert.match(source, /DomainEvents\.COMPANY_ARCHIVED/)
  assert.doesNotMatch(source, /companies:store\.companies\.filter\(/)
  assert.doesNotMatch(source, /COMPANY_DELETED/)
})

test('M1.1-A: SitesPage solo admite empresas activas y preserva la sede al archivar', async () => {
  const source = await readSource('src/pages/SitesPage.jsx')
  assert.match(source, /company\.active===false/)
  assert.match(source, /activeCompanies=state\.companies\.filter\(company=>company\.active!==false\)/)
  assert.match(source, /state\.houses\.filter\(house=>house\.active!==false\)/)
  assert.match(source, /sites:store\.sites\.map\(item=>item\.id===site\.id\?after:item\)/)
  assert.match(source, /active:false,archivedAt/)
  assert.match(source, /DomainEvents\.SITE_ARCHIVED/)
  assert.doesNotMatch(source, /sites:store\.sites\.filter\(item=>item\.id!==site\.id\)/)
  assert.doesNotMatch(source, /SITE_DELETED/)
})
