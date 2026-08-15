# Cierre forense — AUD-F018

## Hallazgo

**AUD-F018 — Passport/Replay — Alto**

El uso del reloj actual durante la construcción de Objetos Inteligentes y Passports hacía que la misma evidencia histórica produjera proyecciones diferentes según el instante de ejecución. Durante replay, el Ledger exponía `recordedAt`, pero no lo convertía en un tiempo contractual de proyección.

## Causa raíz

- `createPassport()` completaba `generatedAt` con `new Date().toISOString()`.
- `createIntelligentObject()` completaba `createdAt` con el reloj actual.
- Las proyecciones de plantas productivas, material vegetal y la fachada histórica inventaban fechas cuando faltaba evidencia.
- `replayLedger()` no fijaba `projectionTime` desde la entrada histórica.

## Corrección

- Se incorporó `DETERMINISTIC_TIMESTAMP` como fallback estable y público.
- `createPassport()` deriva `generatedAt` de `object.updatedAt`, `object.createdAt` o evidencia explícita.
- `createPassportBuilder()` normaliza una única `projectionTime`, la entrega a todos los plugins y la usa como `generatedAt`.
- Las proyecciones vegetales derivan sus fechas únicamente de la entidad, el lote, la genealogía o el fallback estable.
- `replayLedger()` fija `context.projectionTime` desde `entry.recordedAt` y, subsidiariamente, `event.occurredAt`.
- Evidencia temporal inválida durante replay se rechaza antes de ejecutar el proyector.

## Pruebas directas

`tests/block-b-aud-f018-deterministic-time.test.mjs` verifica:

1. igualdad completa entre construcciones repetidas del mismo Passport;
2. tiempo estable entregado a plugins;
3. material vegetal sin fechas;
4. plantas productivas sin fechas;
5. fachada histórica de plantas virtuales;
6. replay repetido con `projectionTime` derivado del Ledger;
7. rechazo de fechas históricas inválidas sin ejecutar efectos.

## Cadena de evidencia

- Contrato temporal determinista: `cbc95c5f493db9502e7a9117ad99c6fd7df2372a`
- Builder con tiempo de proyección: `2a33c62f83d8b8116f44598923a8e5f84fd56d4b`
- Replay ligado a evidencia del Ledger: `83189336b0fa0bca9bc704de33add9e9d407241e`
- Material vegetal: `d413cefcf7dbf99e44803560cb1d63720b27e3a8`
- Planta productiva: `ee62cc6822fa245de0975d856341aec43aa859cd`
- Pruebas iniciales: `5d6280761fd87c71a24093a077d2f13aaa12a64f`
- Fachada histórica corregida: `e85e0984f8bfdfa92b64e43b5cdfd973dd3dfd2b`
- Prueba de reauditoría: `8de8c549fff22360f4eb97515807046711336b1a`
- Contrato público final: `4ad984672178d395c4ec4c8f4fbf265b7de93654`

## Quality

- Quality técnico inicial: `#708` — `success`.
- Quality técnico final tras reauditoría: `#714` — `success`.

## Resultado de reauditoría

La reauditoría independiente encontró una ruta residual en `createPlantPassportFromState()`, que todavía consultaba el reloj cuando un lote histórico no tenía fechas. La ruta fue corregida, cubierta y certificada nuevamente. La revisión posterior no encontró otra lectura del reloj dentro de las proyecciones Passport ni del contexto de replay.

## Riesgo residual

No queda riesgo residual dentro del alcance de `AUD-F018`. Las fechas de sesiones operativas de replay continúan usando un reloj inyectable porque describen la ejecución de la sesión, no el resultado histórico proyectado.

## Dictamen

`AUD-F018` queda **cerrado y certificado**.
