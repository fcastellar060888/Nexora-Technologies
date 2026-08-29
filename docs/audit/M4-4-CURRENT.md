# M4.4 — Finanzas operativas · Reauditoría sobre baseline actual

- Rama: `audit/v3-m4-4-finance-current`
- Base: `audit/v3-m4-3-sales-current`
- Base SHA: `bb04cecf096446dc3d2197d70002fbc432deae6d`
- Regla: ningún hallazgo pasa a Verified sin Quality con runner real y steps ejecutados.

## F001 — Critical — Ready for Quality

Defecto confirmado: `CurrenciesPage` administraba `state.currencies` globalmente por `code`, de modo que monedas homónimas de empresas distintas podían interferir en existencia, actualización y renderizado. Los registros ownerless además podían ser adoptados silenciosamente en estados multiempresa.

Remediación: `src/domain/finance.js` introduce una frontera tenant-aware para monedas; resolución fail-closed de homónimos/ownership ambiguo, validación de organización solicitada, identidad determinística `currency:<organizationId>:<CODE>` y tasa estrictamente positiva. `CurrenciesPage` consume exclusivamente esa autoridad y conserva la organización esperada en el formulario.

Evidence: `tests/finance-tenancy.test.js` cubre mutación exacta de homónimos, spoofing/duplicados intra-tenant, legacy ownerless multiempresa y contrato estático de UI.

**Estado:** F001 Ready for Quality — no Verified.

## F002 — Critical — Ready for Quality

Defecto confirmado: `CostsPage` escribía `costEntries` directamente y calculaba costo acumulado y gramos empacados sobre colecciones globales. Un costo o `packingBatch` homónimo/foreign podía contaminar KPIs financieros del tenant activo; además el formulario aceptaba sedes sin una autoridad financiera que validara ownership.

Remediación: `financialViewForActiveOrganization()` proyecta `costEntries` y `packingBatches` exclusivamente del tenant activo, con inferencia por sede solo cuando el ownership es inequívoco. `createCostEntry()` valida organización solicitada, sede tenant-scoped, importe positivo y persiste `organizationId`/`siteId`. `CostsPage` dejó de leer/escribir arrays financieros globales y consume exclusivamente la autoridad canónica para KPIs y altas.

Evidence: `tests/finance-tenancy.test.js` cubre exclusión de costos y masa foreign con IDs homónimos, spoofing de organización/sede, sellado del nuevo costo y contrato estático de UI contra acceso directo a `state.costEntries`/`state.packingBatches`.

**Estado:** F002 Ready for Quality — no Verified.

## F003 — High — Ready for Quality

Defecto confirmado: aunque Monedas y Costos ya consumían la frontera financiera tenant-aware, `SalesPage` todavía resolvía y listaba monedas directamente desde `state.currencies`. Esto permitía que el selector comercial reintrodujera monedas homónimas foreign u ownerless ambiguas y dejaba una tercera superficie fuera del boundary financiero común.

Remediación: `SalesPage` consume `financialViewForActiveOrganization(state)` para catálogo monetario, resolución de tasa y monedas activas. Ya no existe acceso directo a `state.currencies`; las opciones usan identidad tenant-aware y el stock seleccionado sólo puede resolver tasa contra la proyección financiera de la empresa activa.

Evidence: `tests/finance-tenancy.test.js` incorpora contrato estático contra `state.currencies` en Ventas y adversarial que verifica que la proyección excluye moneda foreign y legacy ambigua.

**Estado:** F003 Ready for Quality — no Verified.

## F004 — High — Ready for Quality

Defecto confirmado: `reserveFinishedGoods()` aceptaba `currency` y `exchangeRate` suministrados por el caller sin validar que la moneda existiera y perteneciera inequívocamente al tenant activo, estuviera habilitada o que la tasa congelada fuese estrictamente positiva. Esto permitía corromper `totalBase` mediante moneda foreign/ownerless/inactiva o tasa 0, negativa o no numérica.

Remediación: `currencyForActiveOrganization()` expone un resolver financiero fail-closed; `reserveFinishedGoods()` resuelve la moneda contra esa autoridad, exige moneda activa, normaliza precio no negativo y tasa congelada positiva antes de persistir la reserva y sus totales.

Evidence: `tests/sales-finance-integrity.test.js` cubre moneda tenant-scoped, rechazo foreign/legacy ambigua, tasa inválida e inactividad.

**Estado:** F004 Ready for Quality — no Verified.

## Pendientes

- F005 — reauditoría confirma defecto real de sync financiero: `currencies` no está sincronizado y `costEntries` no exige ownership financiero de primer nivel. Pendiente de remediación en baseline actual.
- F006 — reauditoría confirma defecto real de migración: `productionLedger` canónico todavía se normaliza como array y puede perder el ledger por fase. Pendiente de remediación en baseline actual.
