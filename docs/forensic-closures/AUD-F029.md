# AUD-F029 — Control optimista en `replaceAll()` del Knowledge Graph

## Hallazgo

`createKnowledgeGraphRepository().replaceAll()` aceptaba un snapshot completo sin exigir la versión del estado sobre el que había sido calculado. Dos escritores podían leer la misma revisión, preparar cambios distintos y confirmar en secuencia; el último reemplazo borraba silenciosamente la escritura concurrente.

## Causa raíz

El repositorio mantenía un contador `version`, pero `replaceAll()` no lo utilizaba como precondición. Passport y la API heredada tomaban snapshots y reemplazaban nodos/aristas sin demostrar que el repositorio continuara en esa revisión.

## Corrección

- `replaceAll()` exige `expectedVersion` entero y no negativo.
- La versión esperada se compara con la revisión vigente antes de normalizar nodos o aristas.
- Una versión ausente, inválida o vencida falla sin modificar nodos, aristas, índices ni versión.
- Passport confirma la proyección usando `current.version` del snapshot leído.
- La API heredada aplica la misma precondición en actualización de nodos, retención de relaciones y desconexión.

## Evidencia

- Contrato optimista del repositorio: `dd5c53d1c9166a6bf413255664016b9e93d29c6e`
- Passport ligado a su snapshot: `628434165b3a521b2c15dbb83e0d696a249f4df4`
- API heredada ligada a sus snapshots: `97474a0512a5e4476a1ce481df6a487a19e2c917`
- Pruebas adversariales: `1c7b2910e0ce24ee8c59c9bd909f434b4f7ca1a1`
- Fixtures heredados actualizados: `726ca4c1c7336977b756a6afad1076dd087d3400`, `690bc70d8b22eafd70582ceef3e237d5300b746d`

## Quality

- `#914`: falló por tres fixtures históricos que omitían `expectedVersion`; las cuatro pruebas nuevas y la lógica productiva pasaron.
- `#918`: success técnico final.

## Pruebas directas

Se verificó que:

- `replaceAll()` rechaza una llamada sin versión esperada;
- un escritor basado en un snapshot vencido no borra una escritura concurrente;
- una escritura con la versión vigente avanza exactamente una revisión;
- el conflicto se detecta antes de evaluar entradas hostiles;
- una validación estructural fallida conserva el estado previo;
- Passport y la API heredada suministran la versión del snapshot que leyeron.

## Resultado de reauditoría

La revisión de `graphRepository.js`, `passportGraphProjection.js` y `knowledgeGraph.js` no encontró una ruta productiva que llame `replaceAll()` sin una versión derivada del snapshot utilizado para calcular el reemplazo.

## Riesgo residual

Un conflicto optimista se expone al consumidor para que vuelva a leer y reintente; no existe reintento automático dentro del repositorio. Esto es deliberado para impedir merges silenciosos o pérdida de escritura.
