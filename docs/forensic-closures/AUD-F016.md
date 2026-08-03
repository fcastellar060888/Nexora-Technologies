# AUD-F016 — Aislamiento multiempresa

## Estado

Cerrado y certificado.

## Riesgo corregido

Las rutas de sincronización compartían estructuras globales y confiaban en que transporte, RPC y coordinación entre pestañas siempre respetarían la empresa solicitada. Esto permitía que una mutación, registro remoto, conflicto, resultado tardío o mensaje de otra pestaña alcanzara el contexto activo de una organización distinta.

## Correcciones

- La cola saliente se filtra obligatoriamente por `companyId`.
- La sincronización rechaza un tenant solicitado distinto al contexto activo.
- Las respuestas remotas y de bootstrap se validan completamente antes de aplicar registros; un solo registro extranjero invalida el lote.
- Las mutaciones pendientes superpuestas durante hidratación se limitan a la empresa activa.
- La resolución de conflictos exige empresa, rechaza conflictos extranjeros y aplica el registro con contexto explícito.
- Los mensajes entre pestañas incluyen `companyId` y el receptor descarta mensajes sin empresa o de otra organización.
- Un resultado de sincronización se descarta íntegramente si la empresa cambia durante la operación.
- La telemetría, salud de dispositivos y broadcasts tardíos también se suprimen tras un cambio de tenant.

## Evidencia automatizada

- `tests/block-b-aud-f016-tenant-isolation.test.mjs`
- `tests/tab-sync-tenant-isolation.test.mjs`
- `tests/block-b-aud-f016-store-race.test.mjs`
- Casos adicionales en `tests/sync-commit.test.mjs`, `tests/sync-conflict-center.test.mjs` y `tests/sync-engine.test.mjs`.

## Certificación

- Quality #654: verde después de completar consumidores tenant-explicit.
- Quality #658: verde después de bloquear commits tardíos tras cambio de empresa.
- Quality #662: verde después de suprimir telemetría y broadcasts tardíos y ejecutar la pasada final.

La auditoría estática, la suite completa y el build de producción pasan. No se identificó una vía residual dentro del alcance de AUD-F016.
