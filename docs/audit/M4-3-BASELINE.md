# M4.3 — Comercial / Ventas y despacho · Baseline forense

## Alcance

- Rama: `audit/v3-m4-3-sales`
- Base apilada: `audit/v3-m4-2-postharvest`
- Base SHA: `913dd539a323759f3ca5eec11554f6c3b7543fdd`
- Superficie: `src/domain/sales.js`, `src/pages/SalesPage.jsx`, `finishedGoods`, `sales`, `finishedGoodsMovements`.
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Mientras GitHub Actions siga sin cuota, un hallazgo puede llegar a `Ready for Quality`, nunca a `Verified`.

## F001 — Critical — Ready for Quality

**Reserva, despacho y cancelación comercial resolvían stock/venta por ID global y podían leer o mutar homónimos de otra empresa.**

### Evidencia / RED

- `tests/sales-tenancy.test.js`
- RED: `396e18a2fc421de87d571e5d6839a4b399f51f06`

El estado previo usaba `find()` por raw `stockId`/`saleId` y `map()` por raw ID. Sale y movimientos tampoco persistían tenancy explícita.

### Remediation

- Dominio tenant-aware: `c9868d3f14b652d02ad7fb26fad2da2d8a899a40`

Garantías:

- empresa activa como autoridad;
- resolución de stock y venta dentro del tenant;
- `foreign-only` y spoof de empresa/sede fallan cerrado;
- homónimos duplicados dentro del tenant fallan como ambiguos;
- mutación por índice exacto, nunca por raw ID global;
- consistencia causal sale ↔ stock por `stockId/siteId/lotId/classification`;
- `organizationId` y `siteId` persistidos en sale, stock actualizado y movimiento.

**Estado:** Ready for Quality. No Verified.

## F002 — High — Ready for Quality

**`SalesPage.jsx` exponía inventario, ventas, KPIs, reservas, historial y joins de lote desde colecciones globales.**

### Evidencia / contrato

- `tests/sales-ui-tenancy.test.js`
- Commit: `d944805115f492fbfd8f66bfca75dd8a59e6ca7d`

### Remediation

- UI tenant-aware: `c10ed26c40e381bd74f0f7b9c8f4841eb7bebb57`
- `salesViewForActiveOrganization(state)` proyecta únicamente `finishedGoods`, `sales`, movimientos y lotes de la empresa activa.
- Los KPIs y listados comerciales se calculan desde `view`, no desde `state.sales`/`state.finishedGoods` globales.
- Los joins de lote se hacen contra lotes ya scoped.
- Los formularios transportan `organizationId` y `siteId` esperados para que un cambio stale de contexto falle cerrado en dominio.

**Estado:** Ready for Quality. No Verified.

## F003 — High — Ready for Quality

**Reserva, despacho y cancelación no tenían replay durable y una identidad de movimiento podía reutilizarse de forma contradictoria.**

### Evidencia / RED

- `tests/sales-idempotency.test.js`
- RED: `a6c3357f81858cfd1a8fe7b349630e084b40c07f`

El contrato exige:

- reserva idéntica con la misma identidad = no-op estable;
- reutilización contradictoria del sale ID = fail closed;
- replay idéntico de despacho/cancelación = no-op estable;
- redispatch/recancel contradictorio = fail closed;
- `movementId` no puede reutilizarse por otro comando dentro del tenant.

### Remediation

- Dominio replay-safe: `868e67de36084c21087212276df31be177beece0`
- UI con identidades estables: `2218394b7b694bbd9d39911b7360ac4bfd1313cd`

Se persisten firmas canónicas por intención (`reserveCommandSignature`, `dispatchCommandSignature`, `cancelCommandSignature`) y la identidad de movimiento asociada. Misma identidad + mismo intent retorna el estado sin descontar/liberar/vender dos veces; misma identidad + intent distinto se rechaza.

**Estado:** Ready for Quality. No Verified.

## Reauditoría

La frontera comercial nueva queda:

`Finished Goods tenant-scoped → Reserva → Despacho/Cancelación → finishedGoodsMovements`

No se encontró una segunda ruta operativa de escritura comercial fuera de `src/domain/sales.js` en la superficie inspeccionada. `SalesPage` consume el boundary scoped y los comandos conservan autoridad organizacional en el write boundary.

## Quality

Los contratos adversariales están comprometidos, pero no se declara ejecución de suite en este bloque porque GitHub Actions sigue sin cuota. El PR permanece draft y el workflow debe quedar `skipped` sin runner. Sólo una ejecución real y verde podrá promover F001–F003 a `Verified`.
