# Cierre forense AUD-F030

## Hallazgo

Coexistían dos APIs públicas del Knowledge Graph en el mismo índice: el contrato canónico basado en `createKnowledgeGraphRepository()` y la fachada histórica basada en `createKnowledgeGraph()`. La exposición equivalente permitía que nuevos consumidores eligieran reglas y formatos diferentes sin declarar una dependencia de compatibilidad.

## Corrección

- `src/core/knowledgeGraph/index.js` expone únicamente contratos, repositorio, política de conflictos y proyección canónicos.
- La compatibilidad histórica quedó aislada en `src/core/knowledgeGraph/legacy.js`.
- La fachada declara estado `deprecated`, autoridad `knowledge-graph-repository` y criterio de retiro.
- Las pruebas heredadas importan explícitamente desde `legacy.js`.
- La fachada conserva un único repositorio canónico y no mantiene almacenamiento, índices ni política de conflicto propios.

## Evidencia

- Fachada heredada aislada: `fc2ebc4567317fd614ac75298fbb19ddd930df4e`
- Índice canónico consolidado: `d5945ec3cfa088c6ea529f67f5ae36d7f9196dd8`
- Consumidores de pruebas migrados: `207ff57ab3b3c120a60fba4ee36cf11a4770a1d1`, `3dda4aa36486b0506bcb4b0682d4c17c71228c91`, `4e774e99cc1a3127525697b8844e1f1b9522620e`
- Prueba contractual: `a46c4d9f90e99d8e438deb4f9bc7c0ec80f444fa`

## Quality

- Quality técnico: `#932` — success.

## Prueba directa

`tests/block-c-aud-f030-graph-api-consolidation.test.mjs` certifica que el índice canónico no reexporta símbolos heredados y que la fachada de compatibilidad declara deprecación y delega al repositorio canónico.

## Resultado de reauditoría

No existen consumidores productivos que dependan de símbolos heredados desde el índice principal. La fachada no implementa un segundo repositorio y las operaciones de reemplazo continúan sujetas al control optimista de `AUD-F029`.

## Riesgo residual

La fachada histórica permanece disponible para compatibilidad explícita hasta que se confirme que no existen consumidores externos. Su uso nuevo debe considerarse prohibido.
