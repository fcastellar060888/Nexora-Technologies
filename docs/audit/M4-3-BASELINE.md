# M4.3 — Comercial / Ventas y despacho · Reauditoría sobre baseline actual

## Alcance

- Rama: `audit/v3-m4-3-sales-current`
- Base apilada: `audit/v3-m4-2-postharvest-current`
- Base SHA: `134fc032458a7e44f38ac4e11237934fd8e6e056`
- Superficie: `src/domain/sales.js`, `src/pages/SalesPage.jsx`, `finishedGoods`, `sales`, `finishedGoodsMovements`.
- Método: Audit → Evidence/Test → Fix → Re-Audit → Quality Gate → Close.
- Ningún hallazgo será `Verified` sin GitHub Actions Quality con runner real y steps ejecutados.

## F001 — Critical — Ready for Quality

Reserva, despacho y cancelación resolvían stock/venta por ID global. Se corrigió con resolución tenant-aware, fail-closed ante ownership ambiguo/foreign, validación causal Sale ↔ FinishedGood, mutación por índice resuelto y tenancy persistida en Sale/movimientos. Evidencia: `tests/sales-tenancy.test.js`.

## F002 — High — Ready for Quality

`SalesPage.jsx` consumía colecciones operacionales globales para KPIs, reservas, historial y joins de lote. Ahora consume `salesViewForActiveOrganization(state)` como frontera única tenant-scoped. Los adversariales introducen homónimos cross-tenant en stock, ventas, movimientos y lotes y verifican exclusión completa del tenant extranjero.

## F003 — High — Ready for Quality

### Defecto confirmado

Los comandos comerciales no tenían replay durable. Repetir una reserva podía descontar stock nuevamente; despacho/cancelación repetidos dependían del estado terminal y fallaban, pero no podían reconocer de forma determinista un retry idéntico. `movementId` tampoco estaba protegido contra reutilización contradictoria dentro del tenant.

### Remediación

- `movementId` funciona como receipt durable tenant-scoped para Reserva, Despacho y Liberación de reserva.
- Un retry idéntico con el mismo `movementId`, tipo, `sourceId`, stock y delta de gramos retorna el estado sin nuevas mutaciones.
- La reutilización del mismo `movementId` para un comando semánticamente contradictorio falla cerrado.
- Reserva también protege `saleId` contra reutilización no respaldada por el receipt idéntico.
- Despacho/cancelación resuelven primero Sale + FinishedGood tenant-aware y validan causalidad antes de aceptar replay.

### Evidence / adversariales

`tests/sales-tenancy.test.js` verifica:

1. reserva idéntica no descuenta dos veces ni duplica Sale/movimiento;
2. despacho idéntico no incrementa `soldGrams` dos veces;
3. cancelación idéntica no libera stock dos veces;
4. reutilización contradictoria de `movementId` falla cerrado.

**Estado M4.3:** F001–F003 Ready for Quality — ninguno Verified.

## Quality

El último Quality observado antes de F003 (`#2771`, HEAD `a30218758fa04a9b99a9b613a2be5e00ea3335a7`) terminó antes de ejecutar código: `steps: []`, `runner_id: 0`, `runner_name: ""`. No constituye evidencia de certificación. El HEAD posterior a F003 requiere un nuevo Quality con runner real y steps ejecutados.
