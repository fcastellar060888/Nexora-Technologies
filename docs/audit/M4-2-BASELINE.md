# M4.2 — Postharvest / Production Flow · Baseline forense

## Alcance

- Rama: `audit/v3-m4-2-postharvest`
- Base apilada: `audit/v3-m4-1-inventory`
- Base SHA: `a2652302ecab3441b2810a3bf2329e21de0baeb3`
- Superficie: `production.js`, Cosecha, Secado, Manicura, Selección, Empaque, Finished Goods, Production Flow y detalle de lote.
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Con la cuota de Actions agotada, un hallazgo puede llegar a `Ready for Quality`, nunca a `Verified`.

## F001 — Critical — Ready for Quality

**El avance de fase de un lote productivo usaba identidad global por `lotId` y podía mutar lotes homónimos de otros tenants.**

- Evidence: `tests/postharvest-tenancy.test.js`
- RED: `3a1d7d4b8abaa85c23d6c78ad204d36d999687cc`
- Remediation: `a4e15be6c926503bffe70cf1a10ec94c0dd3e5f2`
- Focal: **3/3 pass, 0 fail**

El fix deriva autoridad de la empresa activa, resuelve el lote dentro del tenant, rechaza foreign/ambiguous ownership y site mismatch, muta un único índice autorizado y persiste `organizationId`, `siteId` y `lotId` en el evento.

## F002 — High — Ready for Quality

**`Empaque → Finished Goods` calculaba lote, masa disponible y clasificación globalmente por raw `lotId`.**

- Evidence: `tests/postharvest-finished-goods-tenancy.test.js`
- RED: `72ae6b3e5feffdc60f053b5cc11a61abb4432f81`
- Remediation: `f3e488213a4ee2a2aa33f8021cdb11c1de6c2c28`
- Focal: **6/6 pass, 0 fail**

La masa, clasificación y receipts son tenant-local; foreign-only/duplicados/ownership ambiguo fallan cerrado y finished good + movimiento materializan tenancy explícita.

## F003 — High — Ready for Quality

**Las vistas directas de postcosecha leían colecciones globales y varias escribían registros ownerless o mutaban `productionFlows` por raw ID.**

- Evidence inicial: `tests/postharvest-ui-tenancy.test.js`
- RED: `a2b59793de712732cc96956b9e0c298b3e7c184f`
- Authority hardening: `3141bfa541d19e3a6e60690594746da40560a960`
- Boundary inicial: `54cb0b74d270da2b05a4042278bad2c4552be400`
- Cosecha tenant-aware: `f6faf0edf5f72f198871e106d0ddd6230a22345b`
- Secado: `ecc11e310baf979e6b576b40caedb25009e82b13`
- Manicura: `0788d47b5dc93d9fccfa1aebcdb0b134609d03d6`
- Selección: `08379e01643256966e194b064dcb9577d7cceef1`
- Empaque: `62fd7b744b490e62050ccec34eaf20ace2f30839`
- Finished Goods: `c7501d1036c9c82b967d716731c2f941366724c1`
- Production Flow inicial: `c32b027f01a7ffba241b363bc846e4f9bc82373e`
- Focal boundary inicial: **4/4 pass, 0 fail**

F004 posteriormente endurece esta solución: las colecciones legacy quedan como proyecciones históricas de solo lectura y las pantallas operativas pasan a la autoridad canónica.

## F004 — Critical — Ready for Quality

**Existían múltiples autoridades de escritura para el mismo proceso físico: `propagationBatches.productionLedger`, `productionFlows` y los arrays manuales por etapa. Además el flujo canónico permitía inflación de cantidad, `Finalizado` se auto-avanzaba y no existía replay durable por evento.**

### Evidence / RED

- `tests/postharvest-canonical-flow.test.js`
- RED: `f49b452a4766a645fe77c786ac97f3b67801e887`

El contrato adversarial exige:

1. `activeQuantity` nunca puede crecer durante una transición;
2. `Finalizado` es terminal;
3. replay del mismo `eventId` es estable y reutilización contradictoria falla cerrado;
4. la masa Cosecha → Secado → Manicura → Selección → Empaque nunca aumenta;
5. Cosecha conserva entrada húmeda y salida aceptada como masas distintas;
6. `productionFlows` y arrays manuales dejan de ser autoridades operativas;
7. todas las rutas de etapa escriben mediante `advanceProductionLot()`.

### Remediation

**Dominio canónico:** `e89ccd07532fdbfac9953aee69850a684d071aec`

- `advanceProductionLot()` valida cantidad disponible y prohíbe inflación;
- `Finalizado` bloquea toda nueva transición;
- `eventId` + `commandSignature` implementan replay estable: mismo comando retorna el estado sin duplicar; contradicción rechazada;
- Cosecha acepta `inputWeight` separado del `outputWeight` y aplica conservación de masa;
- cada etapa posterior toma como entrada el output de la etapa causal anterior;
- detalles operativos quedan dentro de `productionLedger` + `lotEvent`;
- `appendPostharvestRecord()` y `advanceProductionFlow()` quedan fail-closed como APIs legacy de solo lectura;
- se añaden `canonicalPostharvestLotsForPhase`, `canonicalPostharvestHistory` y `canonicalPostharvestLot`.

**UI canónica compartida:** `1048ad423e7ce30bc509e0528701bf9d00e0bb4b`

- Cosecha → componente canónico: `02849e7ed64f342de6d9a10c10ac40bd067985cc`
- Secado: `78e3829e1d3c2dcfaeb8fe2c5aaf8bdfec23cfde`
- Manicura: `25113a2b9f017bc73d95fd43d950975ef7ae9605`
- Selección: `2f39431f3ef88e28b6332b2ea2a6cd1e74af36dd`
- Empaque: `0e4a36518637c3c098f4b19e48c684c38b4759fc`
- Production Flow canónico: `9425d1d7ae9448d7d8a5dc9359b0a96a73d0cb67`
- Contrato F003/F004 actualizado para legacy read-only: `210af610811e467453b9fd1e4d5c10542c697a1b`
- Contrato F004 final: `8f8d99c7f3240322c026ebb23f4f4f94df0ff481`

Las pantallas de etapa preservan datos propios —días de secado, horas/operarios, grado A/B, bolsas/tamaño— como `details` del ledger/evento canónico, sin crear una segunda verdad.

**Estado:** Ready for Quality. No Verified. La suite completa no se ejecuta hasta recuperar cuota de Actions; los contratos están comprometidos y el HEAD exacto fue reauditorado.

## F005 — High — Confirmed en reauditoría

`LotDetailStablePage` todavía resuelve `propagationBatches`, unidades, genealogía y `lotEvents` mediante búsquedas globales por raw ID. Un `lotId` homónimo puede mostrar información de otra organización aunque el comando de escritura ya falle cerrado. Se cerrará con resolución tenant-aware de la ficha y su timeline.

## Quality / cuota

Los 2.000 minutos incluidos de GitHub Actions están consumidos. El workflow está optimizado para PRs draft: Quality #2433 terminó `skipped` antes de asignar runner. El PR permanecerá draft durante la auditoría gratuita. Sólo una ejecución real y verde después del reset puede promover hallazgos a `Verified`.
