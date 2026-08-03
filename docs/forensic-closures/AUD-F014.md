# Cierre forense AUD-F014

## Hallazgo
El Timeline congelaba únicamente la primera capa de cada entrada. `payload`, `metadata`, arreglos y objetos anidados conservaban referencias compartidas y podían modificarse después de `record()` o `hydrate()`.

## Corrección
- Copia profunda independiente durante la normalización.
- Congelación recursiva de objetos y arreglos.
- Normalización de `-0` y rechazo de números no finitos.
- Rechazo de ciclos, objetos no planos, `Map`, `Set`, símbolos, accessors, propiedades no enumerables y arreglos dispersos/adicionales.
- Atomicidad conservada durante `hydrate()` ante entradas inválidas.

## Evidencia
- Implementación: `65d3f57d173d97c66b4d8f15be840aaa36a5d46d`
- Pruebas directas: `2f790fe0925d54c4d33d88638cf8c4a04ba9627b`
- Quality técnico: `#856` — success

## Prueba directa
`tests/block-c-aud-f014-timeline-deep-immutability.test.mjs`

## Resultado de reauditoría
No se encontró una ruta que permita modificar el estado interno mediante el objeto fuente, `getById()` o `query()`. Las entradas anidadas inválidas se rechazan sin aplicar cambios parciales.

## Riesgo residual
Ninguno conocido dentro del contrato JSON del Timeline.
