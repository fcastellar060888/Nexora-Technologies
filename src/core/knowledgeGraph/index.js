export{createGraphNode,isGraphNode,createGraphEdge,isGraphEdge}from'./graphContract.js'
export{createKnowledgeGraphRepository}from'./graphRepository.js'
export{DEFAULT_SOURCE_PRIORITY,stableFingerprint,sourcePriority,objectVersion,compareProjectionCandidates,preferredProjectionCandidate}from'./conflictResolutionPolicy.js'
export{projectPassportToGraph}from'./passportGraphProjection.js'
export{MAX_KNOWLEDGE_GRAPH_SCOPES,knowledgeGraphRuntimeKey,getKnowledgeGraphForScope,retainKnowledgeGraphScope,releaseRetainedKnowledgeGraphScope,releaseKnowledgeGraphScope,knowledgeGraphScopeCount,knowledgeGraphRuntimeHealth,clearKnowledgeGraphRuntimes}from'./graphRuntime.js'

export const KNOWLEDGE_GRAPH_PUBLIC_API=Object.freeze({
 authority:'knowledge-graph-repository',
 runtime:'workspace-scoped',
 scope:'organizationId+actorId',
 compatibilityFacade:'./legacy.js'
})
