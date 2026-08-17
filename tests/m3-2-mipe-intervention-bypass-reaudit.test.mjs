import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('M32-F006 re-audit: review-task projection exposes no direct reassignment mutator',async()=>{
 const source=await readFile('src/domain/mipeReviewTasks.js','utf8')
 assert.doesNotMatch(source,/export\s+function\s+reassignMipeReviewTask/)
 assert.doesNotMatch(source,/updatedAt=new Date\(\)\.toISOString\(\)/)
})

test('M32-F006 re-audit: production reassignment remains routed through canonical authority',async()=>{
 const source=await readFile('src/services/mipeCommand.js','utf8')
 assert.match(source,/REASSIGN_INTERVENTION/)
 assert.match(source,/reassignCanonicalMipeIntervention/)
 assert.doesNotMatch(source,/reassignMipeReviewTask/)
})
