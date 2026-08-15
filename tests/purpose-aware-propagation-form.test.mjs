import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el formulario exige propósito y planta individual de origen',async()=>{
 const source=await readFile('src/components/PurposeAwarePropagationForm.jsx','utf8')
 assert.match(source,/PROPAGATION_PURPOSE_LABELS/)
 assert.match(source,/propagationSourceUnits/)
 assert.match(source,/Planta individual de origen/)
 assert.match(source,/Abuela o Madre activa/)
})

test('separa renovación de producción y protege el uso productivo de abuelas',async()=>{
 const source=await readFile('src/components/PurposeAwarePropagationForm.jsx','utf8')
 assert.match(source,/No productivo/)
 assert.match(source,/Ingreso a producción/)
 assert.match(source,/Autorizo usar esta Abuela como fuente directa/)
 assert.match(source,/grandmotherProduction/)
})

test('el comando crea lotes y unidades con genealogía propósito y ubicación física',async()=>{
 const form=await readFile('src/components/PurposeAwarePropagationForm.jsx','utf8')
 const command=await readFile('src/services/propagationBatchCommand.js','utf8')
 assert.match(form,/executePropagationBatchCommand/)
 assert.match(command,/createPurposeAwareBatch/)
 assert.match(command,/directParentPlantId/)
 assert.match(command,/targetLifecycleStage/)
 assert.match(command,/entersProduction/)
 assert.match(command,/allocateUnitsToBank/)
})
