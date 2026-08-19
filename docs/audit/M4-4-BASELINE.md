# M4.4 — Finanzas operativas · Baseline forense

## Alcance

- Rama: `audit/v3-m4-4-finance`
- Base apilada: `audit/v3-m4-3-sales`
- Base SHA: `9b38164d1c13f2f345c3eefb3ad7dbd6cf413da0`
- Superficie: monedas, costos, costo por gramo y consumo de moneda desde Ventas.
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Con Actions sin cuota, un hallazgo puede quedar `Ready for Quality`, nunca `Verified`.

## F001 — Critical — Confirmed

`CurrenciesPage` usa `code` como identidad global: crea contra `state.currencies.some(x => x.code === code)` y actualiza con `map(x => x.code === code)`. En estado multiempresa, un mismo código puede pertenecer a varias empresas y una edición puede afectar homónimos. Los seeds `COP/USD/EUR` son ownerless, por lo que su adopción silenciosa sería ambigua cuando existe más de una empresa.

Además `SalesPage` consume `state.currencies` globalmente para sugerir tasa/moneda.

Evidence/RED: `tests/finance-tenancy.test.js` @ `cce8b9ed76de4be6a64c192b4b9304f60ac94a80`.

## F002 — Critical — Confirmed

`CostsPage` suma `state.costEntries` globalmente y calcula gramos empacados desde `state.packingBatches`. Desde M4.2 los arrays manuales de postcosecha son legacy/read-only y la autoridad operativa es `propagationBatches.productionLedger.Empaque`.

Impacto: mezcla de costos cross-tenant y costo/gramo incorrecto o desactualizado respecto del ledger canónico.

Evidence/RED: `tests/finance-tenancy.test.js` @ `cce8b9ed76de4be6a64c192b4b9304f60ac94a80`.

## F003 — High — Confirmed

Las UIs de Monedas/Costos y el selector monetario de Ventas no consumen un boundary financiero tenant-aware. El contrato exige que toda lectura y escritura financiera derive autoridad de la empresa activa, valide sede cuando aplique y falle cerrado ante ownership ambiguo.

Evidence/RED: `tests/finance-tenancy.test.js` @ `cce8b9ed76de4be6a64c192b4b9304f60ac94a80`.

## Quality

El PR se mantendrá draft para que Quality quede `skipped` antes de asignar runner. Ningún F00x será `Verified` sin ejecución real y verde después del reset de cuota.
