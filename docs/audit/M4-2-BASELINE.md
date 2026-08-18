# M4.2 — Postharvest / Production Flow · Baseline forense

## Alcance

- Rama: `audit/v3-m4-2-postharvest`
- Base apilada: `audit/v3-m4-1-inventory`
- Base SHA: `a2652302ecab3441b2810a3bf2329e21de0baeb3`
- Superficie: `production.js`, Cosecha, Secado, Manicura, Selección, Empaque, Finished Goods y Production Flow.
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Con la cuota de Actions agotada, un hallazgo puede llegar a `Ready for Quality`, nunca a `Verified`.

## F001 — Critical — Ready for Quality

**El avance de fase de un lote productivo usaba identidad global por `lotId` y podía mutar lotes homónimos de otros tenants.**

- Evidence: `tests/postharvest-tenancy.test.js`
- RED: `3a1d7d4b8abaa85c23d6c78ad204d36d999687cc`
- Remediation: `a4e15be6c926503bffe70cf1a10ec94c0dd3e5f2`
- Resultado focal: **3/3 pass, 0 fail**

El fix deriva autoridad de la empresa activa, resuelve el lote dentro del tenant, rechaza foreign/ambiguous ownership y site mismatch, muta un solo índice autorizado y persiste `organizationId`, `siteId` y `lotId` en el evento de fase.

## F002 — High — Ready for Quality

**`Empaque → Finished Goods` calculaba lote, masa disponible y clasificación globalmente por raw `lotId`.**

- Evidence: `tests/postharvest-finished-goods-tenancy.test.js`
- RED: `72ae6b3e5feffdc60f053b5cc11a61abb4432f81`
- Remediation: `f3e488213a4ee2a2aa33f8021cdb11c1de6c2c28`
- Resultado focal: **6/6 pass, 0 fail**

El fix hace tenant-local la masa y clasificación, rechaza foreign-only/duplicados/ownership ambiguo, bloquea spoof org/site y persiste tenancy explícita en finished good + movimiento.

## F003 — High — Ready for Quality

**Las vistas directas de postcosecha bypassaban el boundary de dominio: leían colecciones globales y varias escribían registros ownerless o actualizaban flujos por raw ID.**

### Evidencia base

- `ProductionPage`, `DryingPage`, `TrimmingPage`, `SelectionPage` y `PackingPage` recorrían `state.sites` + su historial global y hacían append directo a `state.*Batches` sin `organizationId`.
- `FinishedGoodsPage` calculaba KPIs y tablas sobre `state.finishedGoods` global y resolvía lotes por raw ID.
- `ProductionFlowPage` creaba `productionFlows` ownerless y avanzaba mediante `map(x => x.id === flow.id)`, reproduciendo el patrón de mutación global por ID.

Impacto: exposición cross-tenant, creación de registros postcosecha sin owner y posible mutación de flujos homónimos desde la UI.

### Evidence / RED

- `tests/postharvest-ui-tenancy.test.js`
- RED: `a2b59793de712732cc96956b9e0c298b3e7c184f`
- Hardening de autoridad stale: `3141bfa541d19e3a6e60690594746da40560a960`

El contrato exige:

- vista de postcosecha limitada a la organización activa;
- legacy ownerless visible sólo cuando una sede única demuestra ownership;
- append manual con `organizationId` de primera clase y sede autorizada;
- anti-spoof y protección ante formularios stale tras cambio de empresa;
- `ProductionFlow` resuelto por tenant e índice exacto;
- las siete páginas directas deben consumir el boundary común.

### Remediation

Boundary común en dominio:
- `54cb0b74d270da2b05a4042278bad2c4552be400`
- `postharvestViewForActiveOrganization(state)`
- `appendPostharvestRecord(state, collection, input)`
- `advanceProductionFlow(state, input)`

Vistas tenant-aware:
- Cosecha: `f6faf0edf5f72f198871e106d0ddd6230a22345b`
- Secado: `ecc11e310baf979e6b576b40caedb25009e82b13`
- Manicura: `0788d47b5dc93d9fccfa1aebcdb0b134609d03d6`
- Selección: `08379e01643256966e194b064dcb9577d7cceef1`
- Empaque: `62fd7b744b490e62050ccec34eaf20ace2f30839`
- Finished Goods: `c7501d1036c9c82b967d716731c2f941366724c1`
- Production Flow: `c32b027f01a7ffba241b363bc846e4f9bc82373e`

La selección de genética en las vistas integradas usa el catálogo ya tenant-aware (`geneticProfilesForOrganization`). Los formularios conservan la organización esperada para que un cambio de contexto con IDs homónimos no reinterprete silenciosamente la selección anterior.

### Verificación focal

Boundary de dominio F003: **4/4 pass, 0 fail**. El test estático de las páginas queda incorporado a la suite para Quality.

**Estado:** Ready for Quality. No Verified.

## F004 — Critical — Under investigation

Se confirmó una deuda arquitectónica adicional: existen fuentes paralelas de verdad para el mismo proceso físico (`propagationBatches.productionLedger`, `productionFlows` y los arrays manuales `production/drying/trimming/selection/packingBatches`). Aunque F003 ya las aísla por tenant, todavía pueden registrar pesos/fases incompatibles entre sí. Se auditará conservación de masa, causalidad, transición terminal e idempotencia para converger el proceso a una autoridad canónica.

## Quality / cuota

Los 2.000 minutos incluidos de GitHub Actions están consumidos. El workflow está optimizado para PRs draft: Quality #2433 terminó `skipped` antes de asignar runner. El PR permanecerá draft durante la auditoría gratuita. Sólo una ejecución real y verde después del reset puede promover F001–F003 a `Verified`.
