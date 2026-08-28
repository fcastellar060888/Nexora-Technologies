import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page=fs.readFileSync(new URL('../src/pages/LotDetailStablePage.jsx',import.meta.url),'utf8')

test('F005 lot detail must resolve the route lot through the canonical tenant authority',()=>{
 assert.match(page,/canonicalPostharvestLot/)
 assert.doesNotMatch(page,/propagationBatches\.find\(item=>item\.id===lotId\)/)
})

test('F005 genealogy joins must not use raw global IDs',()=>{
 assert.doesNotMatch(page,/motherPlants\.find\(item=>item\.id===lot\.motherPlantId\)/)
 assert.doesNotMatch(page,/grandmotherPlants\.find\(item=>item\.id===mother\?\.grandmotherPlantId\)/)
 assert.doesNotMatch(page,/genetics\.find\(genetic=>genetic\.id===lot\.geneticId\)/)
})

test('F005 timeline must be tenant-scoped rather than raw lotId-only',()=>{
 assert.doesNotMatch(page,/lotEvents\.filter\(item=>item\.lotId===lot\.id\)/)
 assert.match(page,/canonicalPostharvestLotHistory/)
})
