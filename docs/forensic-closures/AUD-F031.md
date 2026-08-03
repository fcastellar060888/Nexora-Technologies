# AUD-F031 — Retención de aristas y nodos huérfanos

## Hallazgo
La retención de relaciones de la API heredada eliminaba aristas antiguas, pero conservaba indefinidamente los nodos creados automáticamente para sostenerlas.

## Causa raíz
`trimRelations()` reemplazaba la colección de aristas y reutilizaba todos los nodos del snapshot. El modelo no distinguía un nodo de negocio creado explícitamente de un endpoint provisional creado implícitamente por `connect()`.

## Corrección
- Los nodos creados explícitamente se etiquetan como `persistent`.
- Los endpoints creados automáticamente por `connect()` se etiquetan como `relation-scoped`.
- La retención solo evalúa endpoints de las relaciones efectivamente retiradas.
- Un nodo `relation-scoped` se elimina únicamente si no conserva ninguna arista.
- `disconnect()` aplica la misma política acotada.
- Un `upsertNode()` explícito promueve definitivamente un nodo automático a `persistent`.
- Nodos de Ledger u otras fuentes canónicas nunca participan en esta recolección.
- Nodos y aristas se confirman mediante un único `replaceAll()` con `expectedVersion`.

## Evidencia
- Implementación inicial: `1d8537136dc311ef7f61b3912cf4aab069653a6a`
- Pruebas iniciales: `42010b6b7b6399bd0cf5ee58b9ba498f0384412f`
- Ciclo de vida completo: `dbd0f1f054ea610aa77b925c7af4edcf54658871`
- Pruebas finales: `ca6cd01aded3978d990740dec6f99673a64aa703`
- Quality inicial: `#938` success
- Quality final: `#942` success

## Prueba directa
La batería `block-c-aud-f031-graph-orphan-retention.test.mjs` verifica poda por retención, preservación explícita, endpoints compartidos, fuentes canónicas, atomicidad, desconexión y promoción persistente.

## Resultado de reauditoría
No se encontró una ruta que elimine nodos persistentes o de otra fuente. La limpieza se limita al conjunto de endpoints afectados por la operación actual.

## Riesgo residual
La política vive exclusivamente en la fachada heredada deprecada. El repositorio canónico conserva inserción y reemplazo explícitos sin garbage collection implícito.
