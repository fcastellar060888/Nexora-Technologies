# M4.3 — Comercial / Ventas y despacho · Baseline forense

## Alcance

- Rama: `audit/v3-m4-3-sales`
- Base apilada: `audit/v3-m4-2-postharvest`
- Base SHA: `913dd539a323759f3ca5eec11554f6c3b7543fdd`
- Superficie inicial: `src/domain/sales.js`, `src/pages/SalesPage.jsx`, `finishedGoods`, `sales`, `finishedGoodsMovements`.
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Mientras GitHub Actions siga sin cuota, un hallazgo puede llegar a `Ready for Quality`, nunca a `Verified`.

## F001 — Critical — Confirmed

**Reserva, despacho y cancelación comercial resuelven stock/venta por ID global y pueden leer/mutar homónimos de otra empresa.**

### Evidencia

En `src/domain/sales.js`:

- `stockOf(state,id)` usa `state.finishedGoods.find(x => x.id === id)`.
- `reserveFinishedGoods()` actualiza `finishedGoods` mediante `map(x => x.id === stock.id ? ... : x)`.
- `dispatchSale()` y `cancelReservation()` resuelven `state.sales.find(x => x.id === input.saleId)` y vuelven a actualizar ventas/stock por raw ID.
- Sale y movimiento no persisten `organizationId`/`siteId` como autoridad de primera clase.

Impacto demostrado: con IDs repetidos entre tenants, el orden del array decide qué stock/venta se selecciona y el `map()` puede mutar múltiples homónimos. Esto afecta disponibilidad, reservas, gramos vendidos, ingresos y trazabilidad comercial.

### Evidence / RED

- `tests/sales-tenancy.test.js`
- Commit RED: `396e18a2fc421de87d571e5d6839a4b399f51f06`

El contrato adversarial exige:

1. reserva modifica exactamente un stock del tenant activo;
2. stock foreign-only falla cerrado;
3. spoof de organización/sede falla cerrado;
4. identidad duplicada dentro del tenant falla como ambigua;
5. despacho resuelve venta+stock dentro del tenant y no toca homónimos extranjeros;
6. cancelación libera sólo la reserva del tenant activo;
7. sale y movimientos persisten `organizationId` + `siteId`.

**Estado:** Confirmed. Remediation pendiente.

## F002 — High — Under investigation

`SalesPage.jsx` usa `state.finishedGoods`, `state.sales`, `state.propagationBatches` y `state.currencies` globalmente para selectores, KPIs, reservas, historial y joins de lote. Se reauditará después de cerrar F001 para separar exposición de UI de autoridad de dominio.

## F003 — High — Under investigation

Se auditarán idempotencia/replay de reserva-despacho-cancelación, carreras de stock y reutilización contradictoria de IDs de movimiento/venta. No se promoverá hasta tener evidencia adversarial independiente.

## Quality

PR draft + workflow optimizado: los commits de auditoría deben mantener Quality `skipped` sin asignar runner hasta que vuelva la cuota. Ningún hallazgo será `Verified` sin ejecución real y verde.
