import test from'node:test'
import assert from'node:assert/strict'
import{applyPreparedPlantEvent,preparePlantEventCommand}from'../src/services/plantEventCommand.js'

function state(){return{
 currentContext:{companyId:'org-a',siteId:'site-a1'},
 companies:[{id:'org-a'},{id:'org-b'}],
 users:[{id:'u1',name:'Operario',active:true,activeSession:true,remote:true}],
 roles:[{id:'operator',permissions:['record_observations']}],
 memberships:[{id:'m1',userId:'u1',companyId:'org-a',roleId:'operator',siteIds:['site-a1'],status:'active'}],
 sites:[{id:'site-a1',organizationId:'org-a',companyId:'org-a'},{id:'site-a2',organizationId:'org-a',companyId:'org-a'},{id:'site-b1',organizationId:'org-b',companyId:'org-b'}],
 houses:[{id:'house-shared',organizationId:'org-a',siteId:'site-a1'},{id:'house-a2',organizationId:'org-a',siteId:'site-a2'},{id:'house-shared',organizationId:'org-b',siteId:'site-b1'}],
 beds:[{id:'bed-shared',organizationId:'org-a',houseId:'house-shared'},{id:'bed-a2',organizationId:'org-a',houseId:'house-a2'},{id:'bed-shared',organizationId:'org-b',houseId:'house-shared'}],
 plantPositions:[{id:'plant-shared',organizationId:'org-a',bedId:'bed-shared'},{id:'plant-a2',organizationId:'org-a',bedId:'bed-a2'},{id:'plant-shared',organizationId:'org-b',bedId:'bed-shared'}],
 plantEvents:[{id:'same-command',commandId:'same-command',plantId:'plant-shared',organizationId:'org-b',siteId:'site-b1',type:'Observación',title:'Extranjero',detail:'',date:'2026-08-17T10:00:00.000Z'}]
}}

const input={plantId:'plant-shared',commandId:'same-command',type:'Observación',title:'Inspección A',detail:'OK',date:'2026-08-17T10:00:00.000Z'}

test('F010: PlantEvent resuelve un plantId homónimo dentro del tenant activo y preserva el evento extranjero homónimo',()=>{
 const current=state(),prepared=preparePlantEventCommand(current,input)
 assert.equal(prepared.duplicate,false)
 assert.equal(prepared.organizationId,'org-a')
 assert.equal(prepared.siteId,'site-a1')
 const next=applyPreparedPlantEvent(current,prepared)
 assert.equal(next.plantEvents.length,2)
 assert.equal(next.plantEvents.find(item=>item.organizationId==='org-b').title,'Extranjero')
 assert.equal(next.plantEvents.find(item=>item.organizationId==='org-a').title,'Inspección A')
})

test('F010: replay de PlantEvent es tenant-aware y solo acepta payload idéntico del tenant activo',()=>{
 const current=state(),prepared=preparePlantEventCommand(current,{...input,commandId:'cmd-a'})
 const committed=applyPreparedPlantEvent(current,prepared),retry=preparePlantEventCommand(committed,{...input,commandId:'cmd-a'})
 assert.equal(retry.duplicate,true)
 assert.throws(()=>preparePlantEventCommand(committed,{...input,commandId:'cmd-a',title:'Contenido cambiado'}),/contenido diferente/i)
})

test('F010: permiso de observación se valida contra la sede real del target, no contra la sede activa del formulario',()=>{
 const current=state()
 assert.throws(()=>preparePlantEventCommand(current,{...input,plantId:'plant-a2',commandId:'site-bypass'}),/permiso.*sede/i)
})

test('F010: houseId o siteId redundante que contradiga plant→bed→house→site falla cerrado',()=>{
 const siteConflict=state(),plant=siteConflict.plantPositions.find(item=>item.organizationId==='org-a'&&item.id==='plant-shared')
 plant.siteId='site-a2'
 assert.throws(()=>preparePlantEventCommand(siteConflict,{...input,commandId:'site-conflict'}),/ubicación.*contradictoria/i)
 const houseConflict=state(),samePlant=houseConflict.plantPositions.find(item=>item.organizationId==='org-a'&&item.id==='plant-shared')
 samePlant.houseId='house-a2'
 assert.throws(()=>preparePlantEventCommand(houseConflict,{...input,commandId:'house-conflict'}),/ubicación.*contradictoria/i)
})

test('F010: cambio de ubicación canónica entre prepare y apply invalida la intención',()=>{
 const current=state(),prepared=preparePlantEventCommand(current,{...input,commandId:'location-switch'})
 current.memberships[0].siteIds=['site-a1','site-a2']
 current.beds.find(item=>item.organizationId==='org-a'&&item.id==='bed-shared').houseId='house-a2'
 assert.throws(()=>applyPreparedPlantEvent(current,prepared),/ubicación canónica.*cambió/i)
})

test('F010: siteId forma parte de la firma de replay y una relocalización no reutiliza el commandId',()=>{
 const current=state(),prepared=preparePlantEventCommand(current,{...input,commandId:'location-replay'}),committed=applyPreparedPlantEvent(current,prepared)
 committed.memberships[0].siteIds=['site-a1','site-a2']
 committed.beds.find(item=>item.organizationId==='org-a'&&item.id==='bed-shared').houseId='house-a2'
 assert.throws(()=>preparePlantEventCommand(committed,{...input,commandId:'location-replay'}),/contenido diferente/i)
})

test('F010: identidad de planta duplicada dentro del tenant falla cerrado',()=>{
 const current=state();current.plantPositions.push({...current.plantPositions[0],healthStatus:'duplicada'})
 assert.throws(()=>preparePlantEventCommand(current,{...input,commandId:'duplicate-plant'}),/duplicada/i)
})

test('F010: cambio de empresa entre prepare y commit impide confirmar el evento',()=>{
 const current=state(),prepared=preparePlantEventCommand(current,{...input,commandId:'tenant-switch'}),changed={...current,currentContext:{...current.currentContext,companyId:'org-b',siteId:'site-b1'}}
 assert.throws(()=>applyPreparedPlantEvent(changed,prepared),/empresa activa cambió/i)
})
