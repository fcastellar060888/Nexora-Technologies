# M4.4 — Finanzas operativas · Baseline forense

## Alcance

- Rama: `audit/v3-m4-4-finance`
- Base apilada: `audit/v3-m4-3-sales`
- Base SHA: `9b38164d1c13f2f345c3eefb3ad7dbd6cf413da0`
- Superficie: monedas, costos, costo por gramo, valoración comercial, migración y sync financiero.
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Con Actions sin cuota, un hallazgo puede quedar `Ready for Quality`, nunca `Verified`.

## F001 — Critical — Ready for Quality

**Monedas se administraban globalmente por `code` y podían afectar homónimos de otra empresa.**

Evidencia inicial:
- `CurrenciesPage` comprobaba existencia y actualizaba con `state.currencies` global.
- Los seeds `COP/USD/EUR` eran ownerless y sin identidad sincronizable.
- `SalesPage` consultaba `state.currencies` globalmente.

Evidence/RED:
- `tests/finance-tenancy.test.js`
- RED: `cce8b9ed76de4be6a64c192b4b9304f60ac94a80`

Remediation:
- boundary financiero: `aeea1722fc182f5244a18cff5d25a2f50cf5ce65`
- Currencies UI tenant-aware: `54f7ecdc953403175919b187537d6f115571c671`
- identidad estable inicial: `6909f2ec48cb8918f350401a6846933af401f30e`
- identidad determinística `currency:<organizationId>:<CODE>`: `62e8556063702bf44235edaaf03733c84ae7578f`

Semántica final: un código de moneda es único dentro del tenant, homónimos extranjeros se preservan, duplicados intra-tenant fallan cerrado y un registro ownerless multiempresa no se adopta silenciosamente.

## F002 — Critical — Ready for Quality

**Costos y costo/gramo mezclaban tenants y usaban `packingBatches` legacy como masa empacada.**

Evidence/RED:
- `tests/finance-tenancy.test.js`
- RED: `cce8b9ed76de4be6a64c192b4b9304f60ac94a80`

Remediation:
- `financialViewForActiveOrganization()` + `financialMetrics()` en `finance.js`.
- `createCostEntry()` valida empresa+sede y persiste ownership explícito.
- `CostsPage` tenant-aware: `608a538f954a7e302b6606ec2a777fe2e0d518e3`.

La masa financiera ahora proviene exclusivamente de `propagationBatches.productionLedger.Empaque.outputGrams`, la misma autoridad canónica definida en M4.2. `packingBatches` legacy ya no participa en KPIs financieros.

## F003 — High — Ready for Quality

**Monedas, Costos y el selector monetario de Ventas bypassaban un boundary financiero común.**

Evidence/RED:
- contrato estático en `tests/finance-tenancy.test.js` @ `cce8b9ed76de4be6a64c192b4b9304f60ac94a80`.

Remediation:
- Monedas: `54f7ecdc953403175919b187537d6f115571c671`.
- Costos: `608a538f954a7e302b6606ec2a777fe2e0d518e3`.
- Ventas/monedas: `1742d2e90e00cca813370dc71328fbf82c66cebc`.

Las tres superficies consumen autoridad tenant-aware. Los formularios conservan la organización esperada para que un cambio de contexto no reinterprete silenciosamente selecciones previas.

## F004 — High — Ready for Quality

**El dominio comercial aceptaba moneda y tasa congelada suministradas por el caller sin validar semántica financiera.**

Un submit manipulado podía usar moneda inexistente/foreign/ownerless ambigua, moneda inactiva o una tasa `0`, negativa o no numérica y corromper `totalBase`.

Evidence/RED:
- `tests/sales-finance-integrity.test.js`
- RED: `dde440bfcdc4718ce3d0bda59ec79f1716790556`

Remediation:
- resolver de moneda activa fail-closed: `10b8383496eeca2c24409e422aecfe299975141d`.
- validación de moneda + tasa + precio en `reserveFinishedGoods()`: `85a9a86523a48eafec72059ccb19831c4077948b`.
- fixtures heredados alineados con ownership monetario: `e346f847e9589aa9ff3c26fa39173e3aabcc68d5`, `3f1489d20645e465144209511b54a3160a9dabac`.

La reserva sólo acepta una moneda activa del tenant y una tasa congelada estrictamente positiva; el replay mantiene la intención financiera normalizada.

## F005 — Critical — Ready for Quality

**La frontera de sync financiero no garantizaba ownership de primera clase y `currencies` ni siquiera se sincronizaba.**

Evidencia:
- `costEntries` estaba en `SYNCABLE_COLLECTIONS`, pero no en `FIRST_CLASS_OWNERSHIP_SYNC_COLLECTIONS`.
- el envelope `_organizationId` podía actuar como sustituto de ownership de dominio.
- `currencies` no estaba en `SYNCABLE_COLLECTIONS`, permitiendo tasas divergentes entre dispositivos.
- monedas legacy carecían de `id` estable.

Evidence/RED:
- `tests/finance-persistence-sync.test.js`
- RED: `91b90e2c3977284554e1f93b3c705ba2fc7dfc12`

Remediation:
- migración financiera + identidad estable: `6d0737a482875dbce6ade036a0f3e43f6758c026`.
- sync first-class para `currencies` y `costEntries`: `e4e208fded9044c02599f786e232c20a4f07128c`.
- identidad determinística de moneda entre dispositivos: `62e8556063702bf44235edaaf03733c84ae7578f`.

Semántica final: sólo registros financieros con ownership explícito generan diffs; legacy ambiguo queda fuera de sync; hidratación remota materializa `organizationId` de primera clase y no reemplaza homónimos extranjeros.

## F006 — Critical — Ready for Quality

**La migración convertía el ledger canónico de producción en un array vacío.**

`stateMigration.js` normalizaba `productionLedger` con `list(x.productionLedger)`. Como el ledger canónico M4.2 es un objeto por fase, una carga/migración podía convertirlo a `[]`, perdiendo balance de masa y dejando incorrecto el costo/gramo.

Evidence/RED:
- `tests/finance-persistence-sync.test.js`
- RED: `91b90e2c3977284554e1f93b3c705ba2fc7dfc12`

Remediation:
- schema `15 → 16`.
- `productionLedger` se preserva como objeto plano.
- commit: `6d0737a482875dbce6ade036a0f3e43f6758c026`.

La reauditoría del HEAD confirma que `financialMetrics()` consume `productionLedger.Empaque.outputGrams` y la migración ya no destruye esa estructura.

## Reauditoría final

- Monedas: sin lectura/escritura global en `CurrenciesPage`.
- Costos: sin `state.costEntries`/`state.packingBatches` directos para KPIs o historial.
- Ventas: catálogo monetario derivado del boundary financiero.
- Persistencia: schema 16 conserva el ledger objeto.
- Sync: `currencies` + `costEntries` requieren ownership explícito; legacy ambiguo queda inert/fail-closed.
- Rama sigue estrictamente apilada sobre M4.3; `main` no se toca.

**Estado técnico:** 6/6 Ready for Quality.
**Estado certificado:** 0/6 Verified.

## Quality

El PR permanecerá draft para que Quality quede `skipped` antes de asignar runner mientras la cuota gratuita esté agotada. Sólo una ejecución real y completamente verde después del reset puede promover F001–F006 a `Verified`.
