import test from'node:test'
import assert from'node:assert/strict'
import{addCivilDays,businessDate,elapsedCivilDays,operationalTimeZone,operationalToday,parseCivilDate}from'../src/domain/timeAuthority.js'
import{addDays,elapsedDays,lotTiming}from'../src/domain/lifecycle.js'

test('M12-F005: business date respects organization timezone around UTC midnight',()=>{
 const instant='2026-08-15T02:00:00.000Z'
 assert.equal(businessDate(instant,'America/Bogota'),'2026-08-14')
 assert.equal(businessDate(instant,'UTC'),'2026-08-15')
})

test('M12-F005: civil day arithmetic is independent of DST and leap years',()=>{
 assert.equal(addCivilDays('2026-03-07',2),'2026-03-09')
 assert.equal(elapsedCivilDays('2024-02-28','2024-03-01'),2)
 assert.equal(addDays('2024-02-28',1),'2024-02-29')
 assert.equal(elapsedDays('2024-02-28','2024-03-01'),2)
})

test('M12-F005: invalid civil dates and timezones fail closed',()=>{
 assert.throws(()=>parseCivilDate('2026-02-30'),/no existe/)
 assert.throws(()=>businessDate(new Date(),'Mars\/Olympus'),/Zona horaria inválida/)
 assert.throws(()=>addCivilDays('2026-01-01',1.5),/entero/)
})

test('M12-F005: operational timezone prefers site then organization',()=>{
 const state={companies:[{id:'org-a',timezone:'America/Bogota'}],sites:[{id:'site-a',companyId:'org-a',timezone:'America/Lima'},{id:'site-b',companyId:'org-a'}],currentContext:{companyId:'org-a',siteId:'site-a'}}
 assert.equal(operationalTimeZone(state),'America/Lima')
 assert.equal(operationalTimeZone(state,'site-b'),'America/Bogota')
 assert.equal(operationalToday(state,{now:'2026-08-15T02:00:00Z',siteId:'site-b'}),'2026-08-14')
})

test('M12-F005: lot timing preserves business rules while using civil date authority',()=>{
 const state={companies:[{id:'org-a',timezone:'America/Bogota'}],sites:[{id:'site-a',companyId:'org-a'}],currentContext:{companyId:'org-a',siteId:'site-a'},phaseTargets:[]}
 const result=lotTiming(state,{siteId:'site-a',geneticId:'g1',phase:'Vegetativo',phaseStartedAt:'2026-08-01'},'2026-08-15')
 assert.equal(result.elapsed,14)
 assert.equal(result.objective,21)
 assert.equal(result.remaining,7)
 assert.equal(result.dueDate,'2026-08-22')
 assert.equal(result.week,3)
 assert.equal(result.status,'Próximo')
})
