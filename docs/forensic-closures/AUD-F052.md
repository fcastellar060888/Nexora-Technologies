# AUD-F052 — Runtime productivo único del Knowledge Graph

## Hallazgo
El Knowledge Graph saneado solo existía como fábrica. No había un repositorio productivo único ligado al workspace activo, por lo que futuros consumidores podían crear instancias por página, hook o módulo.

## Corrección
- Se creó `graphRuntime.js` como registro canónico por `organizationId + actorId`.
- `getKnowledgeGraphForScope()` devuelve siempre la misma instancia para el mismo workspace.
- Empresas o actores diferentes reciben repositorios independientes.
- Se añadieron operaciones explícitas de liberación y limpieza de scopes.
- `KnowledgeGraphRuntimeProvider` resuelve el scope desde `Store.currentContext.companyId` y el usuario activo.
- El provider se montó una sola vez dentro de `StoreProvider` en `main.jsx`.
- El índice público declara `runtime: workspace-scoped` y `scope: organizationId+actorId`.

## Pruebas directas
`tests/block-c-aud-f052-knowledge-graph-runtime.test.mjs` verifica:
1. unicidad por workspace;
2. aislamiento por empresa y actor;
3. liberación sin afectar otros scopes;
4. identidad de scope obligatoria;
5. montaje único dentro del Store;
6. resolución por contexto activo sin creación directa en el provider.

## Quality
- #954: falló por una expectativa antigua de AUD-F030 que no incluía el nuevo descriptor de runtime; todas las pruebas nuevas pasaron.
- #956: success técnico final.

## Reauditoría
La creación productiva quedó centralizada en `graphRuntime.js`. El provider solo resuelve instancias y no mantiene repositorios alternos. La fachada `legacy.js` continúa aislada y deprecada; no forma parte del runtime montado.

## Riesgo residual
La proyección automática de datos operativos hacia el Graph deberá conectarse mediante consumidores explícitos del provider, sin crear repositorios nuevos. Este cierre certifica la autoridad y el ciclo de vida del runtime productivo.
