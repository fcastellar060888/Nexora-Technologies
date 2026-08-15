import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const bed=await readFile(new URL('../src/components/BedManager.jsx',import.meta.url),'utf8')
const bank=await readFile(new URL('../src/components/PropagationBankManager.jsx',import.meta.url),'utf8')
const app=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8')

test('BedManager no crea medio textual y expone assignment canónico',()=>{assert.doesNotMatch(bed,/Field label="Medio"/);assert.doesNotMatch(bed,/growingMedium:form\.growingMedium/);assert.match(bed,/growingMediumAssignmentId/);assert.match(bed,/createProductionPositions/)} )

test('PropagationBankManager no captura substrate ni mediumLot en nuevas bandejas',()=>{assert.doesNotMatch(bank,/Field label="Medio"/);assert.doesNotMatch(bank,/Field label="Lote del medio"/);assert.match(bank,/growingMediumAssignmentId/);assert.match(bank,/Volumen de medio requerido/)} )

test('la autoridad M2.2 tiene una ruta protegida de administración',()=>{assert.match(app,/path="\/growing-medium"/);assert.match(app,/permission="manage_cultivation"/);assert.match(app,/GrowingMediumPage/)} )
