# M4.3 — Comercial / Ventas y despacho · Reauditoría sobre baseline actual

## Alcance

- Rama: `audit/v3-m4-3-sales-current`
- Base apilada: `audit/v3-m4-2-postharvest-current`
- Base SHA: `134fc032458a7e44f38ac4e11237934fd8e6e056`
- Superficie inicial: `src/domain/sales.js`, `src/pages/SalesPage.jsx`, `finishedGoods`, `sales`, `finishedGoodsMovements`.
- Método: Audit → Evidence/Test → Fix → Re-Audit → Quality Gate → Close.
- Ningún hallazgo será `Verified` sin GitHub Actions Quality con runner real y steps ejecutados.

## F001 — Critical — Ready for Quality

**Reserva, despacho y cancelación comercial resolvían stock/venta por ID global y podían leer o mutar homónimos de otra empresa.**

### Evidencia de reauditoría

En el baseline actual de M4.2, `src/domain/sales.js` todavía contenía:

- `stockOf(state,id)` con `state.finishedGoods.find(x => x.id === id)`;
- mutación de `finishedGoods` mediante `map(x => x.id === stock.id ? ... : x)`;
- resolución de `sales` por `find(x => x.id === input.saleId)`;
- mutación de venta/stock por raw ID;
- Sale y movimientos sin `organizationId`/`siteId` como autoridad persistida.

El defecto permite que IDs homónimos entre empresas seleccionen o muten registros ajenos según el orden del array.

### Remediación

`src/domain/sales.js` ahora:

1. resuelve la empresa activa mediante `activeOrganizationId()`;
2. resuelve stock y venta por ID + ownership tenant-aware;
3. falla cerrado ante foreign-only, ownership ambiguo o duplicados dentro del tenant activo;
4. rechaza `organizationId` o `siteId` contradictorios enviados por el comando;
5. valida consistencia causal Sale ↔ FinishedGood;
6. muta exclusivamente el índice exacto resuelto;
7. persiste `organizationId` y `siteId` en Sale, FinishedGood materializado y movimientos;
8. expone `salesViewForActiveOrganization()` como proyección tenant-scoped para la siguiente reauditoría de UI.

### Evidence / adversariales

- `tests/sales-tenancy.test.js`
- Reserva modifica exactamente un stock homónimo del tenant activo.
- Stock foreign-only y spoof de autoridad fallan cerrado.
- Identidad duplicada same-tenant falla como ambigua.
- Despacho resuelve venta+stock dentro del tenant activo y no toca homónimos extranjeros.
- Cancelación libera únicamente la reserva del tenant activo.
- Sale y movimientos conservan `organizationId` + `siteId`.

**Estado:** Ready for Quality — no Verified.

## F002 — High — Under investigation

Reauditar `SalesPage.jsx`: selectores, KPIs, reservas, historial, monedas y joins de lote deben consumir proyecciones tenant-scoped y no colecciones globales.

## F003 — High — Under investigation

Reauditar idempotencia/replay de reserva-despacho-cancelación, carreras de stock y reutilización contradictoria de IDs de movimiento/venta. Requiere evidencia adversarial independiente.

## Quality

F001 permanece `Ready for Quality` hasta obtener un GitHub Actions Quality con runner real y steps ejecutados. Un workflow abortado antes de asignar runner no constituye evidencia de certificación.
