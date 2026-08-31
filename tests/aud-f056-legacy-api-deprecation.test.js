import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { KNOWLEDGE_GRAPH_PUBLIC_API } from '../src/core/knowledgeGraph/index.js'
import { LEGACY_KNOWLEDGE_GRAPH_API } from '../src/core/knowledgeGraph/legacy.js'

const canonicalSource = fs.readFileSync(new URL('../src/core/knowledgeGraph/index.js', import.meta.url), 'utf8')
const legacySource = fs.readFileSync(new URL('../src/core/knowledgeGraph/legacy.js', import.meta.url), 'utf8')

test('legacy Knowledge Graph facade is explicitly deprecated and points to the canonical authority', () => {
  assert.equal(LEGACY_KNOWLEDGE_GRAPH_API.status, 'deprecated')
  assert.equal(LEGACY_KNOWLEDGE_GRAPH_API.authority, KNOWLEDGE_GRAPH_PUBLIC_API.authority)
  assert.equal(LEGACY_KNOWLEDGE_GRAPH_API.replacement, 'src/core/knowledgeGraph/index.js')
  assert.match(LEGACY_KNOWLEDGE_GRAPH_API.removalCriterion, /external consumers migrate/i)
})

test('canonical Knowledge Graph API declares compatibility facade without re-exporting legacy contract as canonical', () => {
  assert.equal(KNOWLEDGE_GRAPH_PUBLIC_API.compatibilityFacade, './legacy.js')
  assert.match(canonicalSource, /createKnowledgeGraphRepository/)
  assert.doesNotMatch(canonicalSource, /export\s*\{[^}]*objectRef/)
  assert.doesNotMatch(canonicalSource, /export\s*\{[^}]*graphNode/)
  assert.doesNotMatch(canonicalSource, /export\s*\{[^}]*graphRelation/)
})

test('compatibility facade remains visibly marked and carries a retirement policy', () => {
  assert.match(legacySource, /status:'deprecated'/)
  assert.match(legacySource, /replacement:'src\/core\/knowledgeGraph\/index\.js'/)
  assert.match(legacySource, /removalCriterion:/)
})
