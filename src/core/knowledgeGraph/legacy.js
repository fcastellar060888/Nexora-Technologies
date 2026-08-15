export{objectRef,graphNode,graphRelation,createKnowledgeGraph,passportRelationships}from'./knowledgeGraph.js'

export const LEGACY_KNOWLEDGE_GRAPH_API=Object.freeze({
 status:'deprecated',
 authority:'knowledge-graph-repository',
 replacement:'src/core/knowledgeGraph/index.js',
 removalCriterion:'remove after all external consumers migrate to the canonical repository contract'
})
