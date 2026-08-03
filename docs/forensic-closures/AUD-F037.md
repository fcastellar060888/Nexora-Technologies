# AUD-F037 — Retención acotada de checkpoints y sesiones de replay

## Hallazgo

Los checkpoints del Projection Engine y las sesiones administradas de replay podían crecer sin límite durante la vida del runtime.

## Causa raíz

- `ProjectionCheckpointStore` mantenía todos los checkpoints completados en un `Set` sin capacidad ni política explícita de compactación.
- `ReplaySessionManager` conservaba indefinidamente sesiones completadas, canceladas y fallidas.
- Eliminar checkpoints automáticamente habría reabierto eventos ya procesados y roto la idempotencia certificada por AUD-F034.

## Corrección

### Checkpoints

- Se añadió `maxCompleted`, validado como entero positivo.
- La confirmación se bloquea antes de superar la capacidad; ningún checkpoint previo se elimina silenciosamente.
- `snapshot()` expone `maxCompleted` y `remainingCapacity`.
- `hydrate()` valida la capacidad antes de modificar estado y conserva atomicidad.
- `compact({ remove })` exige una lista explícita, rechaza ejecutarse con claims activos y devuelve un reporte auditable.
- Los claims fallidos por saturación se liberan tanto en el store como en la fachada persistente.

### Sesiones de replay

- Se añadió `maxSessions`, con valor predeterminado acotado.
- Antes de iniciar una sesión se eliminan únicamente sesiones terminales antiguas (`completed`, `cancelled`, `failed`).
- Las sesiones activas o en cancelación nunca se expulsan.
- Si toda la capacidad está ocupada por sesiones activas, una nueva sesión se rechaza explícitamente.
- Se añadieron `compact()` y `status()` para operación y diagnóstico.

## Pruebas directas

`tests/block-d-aud-f037-bounded-retention.test.mjs`

Verifica:

1. Saturación sin pérdida de idempotencia.
2. Compactación explícita y auditable.
3. Hidratación atómica ante exceso de capacidad.
4. Liberación de claims globales e individuales durante saturación.
5. Compactación automática solo de sesiones terminales.
6. Preservación de sesiones activas al alcanzar capacidad.

## Quality

- Ejecución técnica inicial: `#1024` — success.
- Ejecución tras reauditoría y corrección de claims: `#1028` — success.

## Resultado de reauditoría

No existe ruta que elimine checkpoints automáticamente. La saturación falla de forma visible y conserva todos los checkpoints confirmados. La compactación no puede ejecutarse con claims activos. La fachada persistente libera cualquier claim cuya confirmación falle. Las sesiones activas permanecen protegidas y solo se retiran sesiones terminales antiguas.

## Riesgo residual

La compactación de checkpoints reduce deliberadamente la ventana de idempotencia. En producción deberá ejecutarse únicamente después de persistir o archivar la evidencia correspondiente y de definir una frontera operacional segura. AUD-F051 deberá inyectar un backend durable y compartido; el store efímero no será autoridad productiva.

## Evidencia

- Capacidad y compactación de checkpoints: `7d9321d274c27b48915d31eed7f33b21ad900b67`.
- Retención de sesiones: `0cb60e156cbe9c1ac27634e0b9634af711534c01`.
- Pruebas adversariales iniciales: `08ae73f6280548c0af829c90547a4f0ec1dea22b`.
- Liberación de claims bajo presión: `0a2dbd71494b2d60559ab4f0c72c6797bd5f4917`.
- Prueba final de claims: `0bc1dc1df835425893e3dd2a63c5fb6e4f9496f7`.
