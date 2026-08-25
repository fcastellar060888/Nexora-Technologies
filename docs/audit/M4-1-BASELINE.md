# M4.1 — Inventory · Baseline forense

## Alcance

- Rama: `audit/v3-m4-1-inventory`
- Base apilada: `audit/v3-m3-2-mipe`
- Base SHA: `7ffbdb6123d1736d1269e159ff14c6eaef7097ff`
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Regla de certificación: ningún hallazgo se marca `Verified` sin una ejecución funcional y verde de Quality.

## F001 — Critical — Ready for Quality

**Transacciones manuales de inventario podían cruzar tenants y corromper lotes homónimos.**

### Evidencia

En el SHA base, `transactInventory()` resolvía el lote con `find()` global por `lotId` y actualizaba `inventoryLots` mediante `map()` global por el mismo ID. No existía una autoridad organizacional explícita en el boundary y el movimiento no persistía `organizationId` de primera clase.

- Test: `tests/inventory-tenancy.test.js`
- RED/evidence: `eef8e7478ccfb660852fcdb283e97c613af3c051`
- Ajuste de autoridad activa: `d7eabc42ec7144fdc5cd5be7824172de8bc8027e`

### Remediation

Commit: `40c446815d56458c3d1923a47119f95d053f50e1`

- autoridad desde `activeOrganizationId(state)`;
- rechazo de `organizationId` contradictorio del caller;
- resolución tenant-aware del lote;
- foreign/ambiguous ownership falla cerrado;
- mutación de exactamente un índice autorizado;
- `organizationId` y `siteId` explícitos en movimientos;
- `organizationId` explícito en lotes nuevos.

### Verificación focal

**3/3 pass**. No sustituye Quality.

---

## F002 — High — Ready for Quality

**El sync envelope podía actuar como sustituto del ownership de dominio de Inventory.**

### Evidencia

`collectionChanges()` y `enqueueChanges()` permitían que `inventoryLots` / `inventoryMovements` ownerless recibieran `_organizationId` sólo al salir por sync. `applyRemoteRecords()` tampoco materializaba necesariamente `organizationId` de primera clase.

- Test: `tests/inventory-sync-ownership.test.js`
- RED/evidence: `5d67ac01c521b4013684cffd717ff8078305e18f`

### Remediation

Commit: `1c2b072f552c96ea88976416cfb26b34639ad840`

- lotes y movimientos exigen `organizationId` de dominio antes de sync;
- owner declarado debe coincidir con empresa activa;
- `_organizationId` queda como metadata de transporte;
- hidratación remota materializa `organizationId` desde company scope validado.

### Verificación focal

`node --test tests/inventory-sync-ownership.test.js`: **3/3 pass, 0 fail**. No sustituye Quality.

---

## F003 — High — Ready for Quality

**Inventory legacy ownerless podía ser adoptado ambiguamente durante migración/hidratación.**

### Evidencia

`stateMigration.js` no materializaba ownership de lotes/movimientos legacy y `applyRemoteRecords()` aceptaba un homónimo local ownerless como candidato del tenant activo.

- Test: `tests/inventory-legacy-ownership.test.js`
- RED/evidence: `4d9dc0449799babed2f3440d54c8be46ef57552c`

### Remediation

- Migración determinística: `848ab3d33d0e83a2ce6d544d0c8a80942c717faf`
- Sync fail-closed: `4f912669f260bb2fe497063c4f4faad02d92ae23`

Cambios:

- `CURRENT_SCHEMA_VERSION` → `15`;
- owner legacy sólo se deriva desde sede explícitamente poseída o instalación inequívocamente monoempresa;
- empresa activa no atribuye por sí sola ownership legacy en multiempresa;
- homónimo ownerless bloquea hidratación hasta migración;
- duplicado intra-tenant bloquea por ambigüedad;
- homónimos extranjeros se preservan.

### Verificación focal

**4/4 pass, 0 fail**. No sustituye Quality.

---

## F004 — High — Ready for Quality

**Creación de lotes no probaba ownership de producto/sede y aplicaba unicidad con IDs crudos sin tenant scope.**

### Evidencia

`createInventoryLot()` sólo comprobaba presencia de `productId` y `siteId`, no que pertenecieran a la empresa activa. Su duplicate check usaba `productId + siteId + lotNumber` globalmente, provocando falsos conflictos cross-tenant y permitiendo relaciones con referencias extranjeras.

- Test: `tests/inventory-lot-creation-tenancy.test.js`
- RED/evidence: `03e53651382f3e90ed3ecc0180869ec8f3862f80`

Casos adversariales:

- producto extranjero;
- sede extranjera;
- spoof de `organizationId`;
- mismo raw `productId + siteId + lotNumber` en tenants distintos;
- duplicado dentro del tenant;
- identidad de producto ambigua dentro del tenant.

### Remediation

Commit: `8327a3f9c6e1f8b788f2e3c54a8d0feeb8c1fa90`

- producto y sede se resuelven por ID + tenant;
- spoof organizacional rechazado;
- referencias ownerless/duplicadas en multiempresa fallan cerradas;
- `lotNumber` es único sólo dentro del tenant para el mismo producto+sede;
- homónimos extranjeros explícitos no bloquean creación legítima;
- identidad de lote duplicada dentro del tenant se rechaza.

### Verificación focal

F004: **6/6 pass**. F001 + F004: **9/9 pass, 0 fail**. No sustituye Quality.

---

## F005 — High — Ready for Quality

**La capa de lectura/UI de Inventory exponía colecciones globales aunque el dominio ya bloqueara escrituras cross-tenant.**

### Hallazgo de reauditoría

Después de cerrar F001–F004, la reauditoría encontró que:

- `InventoryPage.jsx` renderizaba selectores y existencias desde `state.products`, `state.sites` y `state.inventoryLots` globales;
- `InventoryMovementsPage.jsx` renderizaba selector de lotes y kardex desde `state.inventoryLots` y `state.inventoryMovements` globales;
- lookups por raw ID podían mostrar nombres asociados a homónimos de otra organización.

Impacto: exposición de lectura cross-tenant en la UI, aunque las mutaciones de dominio fallaran cerradas.

### Evidencia adversarial

- Test: `tests/inventory-view-tenancy.test.js`
- RED/evidence: `1125b1cf951333f1b41a6f9d9e120dcd7418d982`

La prueba exige:

1. mostrar únicamente productos, sedes, lotes y movimientos del tenant activo aun con IDs homónimos;
2. ocultar ownerless en un estado multiempresa;
3. mantener compatibilidad legacy en una instalación inequívocamente monoempresa.

### Remediation

- Selector tenant-aware: `555444d2dc0c491329f89a53ddda41a921568a36`
- `InventoryPage.jsx`: `aba54235f384a26da9589c86284ca5f725b2b4f7`
- `InventoryMovementsPage.jsx`: `8280e4523fadb625cc481a92ca3c6f4b2b15c060`

Cambios:

- `inventoryViewForActiveOrganization(state)` centraliza el scope de lectura;
- productos y sedes ownerless se ocultan en multiempresa y sólo se derivan en instalación monoempresa/local inequívoca;
- lotes y movimientos se filtran por ownership compatible con sede y tenant;
- selectores de producto/sede/lote usan únicamente colecciones scoped;
- tablas de existencias y kardex usan únicamente colecciones scoped;
- al cambiar de organización activa, los formularios reajustan selecciones que ya no pertenecen al nuevo scope;
- el domain guard continúa siendo la autoridad de escritura; el filtro UI es una segunda defensa para confidencialidad/UX.

### Verificación focal

F005: **3/3 pass**. Regresión conjunta F001 + F004 + F005: **12/12 pass, 0 fail**.

La inspección posterior de ambas páginas confirmó que las colecciones renderizadas provienen del selector tenant-aware y no de los arrays globales de Inventory.

**Estado:** Ready for Quality. No Verified.

---

## Resultado de reauditoría M4.1

M4.1 Inventory queda con **5 hallazgos confirmados y técnicamente corregidos**:

- F001 Critical — Ready for Quality
- F002 High — Ready for Quality
- F003 High — Ready for Quality
- F004 High — Ready for Quality
- F005 High — Ready for Quality

**Estado técnico: 5/5 Ready for Quality.**

**Estado certificado: 0/5 Verified**, porque GitHub Actions continúa sin iniciar runner.

La reauditoría no permite considerar el bloque `Verified` hasta que un Quality Gate funcional ejecute la suite completa y termine verde.

## Quality

Quality #2420 sobre el HEAD previo al cierre de F005 terminó con job `95867983215`, `failure`, `steps: null`, `logs_url: null`: no hubo runner ni ejecución de código.

El HEAD final posterior a F005 debe evaluarse con el mismo criterio. Un fallo pre-runner no se interpreta como regresión funcional ni habilita certificación. Sólo un run con steps reales y conclusión verde permite promover F001–F005 a `Verified`.
