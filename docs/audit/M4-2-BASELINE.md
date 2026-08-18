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
- Focal previo: **3/3 pass, 0 fail**

El fix deriva autoridad de la empresa activa, resuelve el lote dentro del tenant, rechaza foreign/ambiguous ownership y site mismatch, muta un único índice autorizado y persiste `organizationId`, `siteId` y `lotId` en el evento.

## F002 — High — Ready for Quality

**`Empaque → Finished Goods` calculaba lote, masa disponible y clasificación globalmente por raw `lotId`.**

- Evidence: `tests/postharvest-finished-goods-tenancy.test.js`
- RED: `72ae6b3e5feffdc60f053b5cc11a61abb4432f81`
- Remediation: `f3e488213a4ee2a2aa33f8021cdb11c1de6c2c28`
- Focal previo: **6/6 pass, 0 fail**

La masa, clasificación y receipts son tenant-local; foreign-only/duplicados/ownership ambiguo fallan cerrado y finished good + movimiento materializan tenancy explícita.

## F003 — High — Ready for Quality

**Las vistas directas de postcosecha leían colecciones globales y varias escribían registros ownerless o mutaban `productionFlows` por raw ID.**

- Evidence inicial: `tests/postharvest-ui-tenancy.test.js`
- RED: `a2b59793de712732cc96956b9e0c298b3e7c184f`
- Authority hardening: `3141bfa541d19e3a6e60690594746da40560a960`
- Boundary inicial: `54cb0b74d270da2b05a4042278bad2c4552be400`
- Finished Goods tenant-aware: `c7501d1036c9c82b967d716731c2f941366724c1`
- Contrato final legacy read-only: `210af610811e467453b9fd1e4d5c10542c697a1b`

F004 culmina esta corrección convirtiendo todas las rutas operativas de etapa a una única autoridad canónica.

## F004 — Critical — Ready for Quality

**Existían múltiples autoridades de escritura para el mismo proceso físico: `propagationBatches.productionLedger`, `productionFlows` y los arrays manuales por etapa. El flujo canónico además permitía inflación de cantidad, `Finalizado` se auto-avanzaba y no existía replay durable por evento.**

### Evidence / RED

- `tests/postharvest-canonical-flow.test.js`
- RED: `f49b452a4766a645fe77c786ac97f3b67801e887`
- Contrato final: `8f8d99c7f3240322c026ebb23f4f4f94df0ff481`

### Remediation

**Dominio canónico:** `e89ccd07532fdbfac9953aee69850a684d071aec`

- `activeQuantity` no puede aumentar durante una transición;
- `Finalizado` es terminal;
- `eventId + commandSignature` implementan replay estable y rechazo de contradicción;
- Cosecha conserva entrada húmeda y salida aceptada como masas distintas;
- cada etapa posterior toma la masa de la etapa causal anterior y no puede superarla;
- detalles de secado/manicura/selección/empaque quedan dentro de `productionLedger + lotEvent`;
- `appendPostharvestRecord()` y `advanceProductionFlow()` quedan fail-closed como APIs legacy de solo lectura;
- `productionFlows` y arrays manuales se conservan únicamente como histórico compatible.

**UI canónica:**

- Componente compartido: `1048ad423e7ce30bc509e0528701bf9d00e0bb4b`
- Cosecha: `02849e7ed64f342de6d9a10c10ac40bd067985cc`
- Secado: `78e3829e1d3c2dcfaeb8fe2c5aaf8bdfec23cfde`
- Manicura: `25113a2b9f017bc73d95fd43d950975ef7ae9605`
- Selección: `2f39431f3ef88e28b6332b2ea2a6cd1e74af36dd`
- Empaque: `0e4a36518637c3c098f4b19e48c684c38b4759fc`
- Production Flow canónico: `9425d1d7ae9448d7d8a5dc9359b0a96a73d0cb67`

**Estado:** Ready for Quality. No Verified. Los contratos adversariales están comprometidos; la suite completa se reserva para el reset de cuota.

## F005 — High — Ready for Quality

**Hallazgo de reauditoría: `LotDetailStablePage` todavía resolvía lote, unidades, genealogía, genética y timeline mediante joins globales por raw ID.**

Con IDs homónimos, la ficha podía mostrar el lote o relaciones de otra organización aunque el comando de transición ya estuviera tenant-safe.

### Evidence / RED

- `tests/postharvest-lot-detail-tenancy.test.js`
- RED: `d655efbec8ad8702d73342427065b003309ed50c`
- Test ligado al proyector final: `26ab2abe1516047d8d676c394ded8ff3deb818ba`

Casos:

- mismo `lotId` en dos empresas con lote extranjero primero;
- unidades homónimas y unidad ownerless ambigua;
- madre/abuela/genética con IDs repetidos entre empresas;
- timeline con eventos homónimos y legacy ownerless;
- duplicado relacionado dentro del tenant activo falla cerrado.

### Remediation

- Proyector tenant-scoped: `7bb1fbb934fe3b873b5226529ece6bdac39ec0e9`
- Ficha canónica: `e863cc0de5a5e252e2a43cd13588dae8b6277a39`

`canonicalPostharvestLotDetail()` parte del lote canónico autorizado y resuelve unidades, madre, abuela, genética, sede y eventos dentro de la misma organización. Legacy ambiguo se excluye; una identidad singular duplicada dentro del tenant falla cerrado. `LotDetailStablePage` usa ese proyector y envía `organizationId`, `siteId` y un `eventId` estable en cada transición; la fase terminal ya no muestra comando de avance.

**Estado:** Ready for Quality. No Verified.

## Resultado del bloque

- **5/5 hallazgos técnicamente corregidos y Ready for Quality.**
- **0/5 Verified** mientras GitHub Actions no tenga minutos incluidos disponibles.
- Autoridad operativa final: `propagationBatches + productionLedger + lotEvents`.
- Transferencia a inventario terminado: `receiveFinishedGoods()` con balance de masa tenant-aware.
- Arrays manuales y `productionFlows`: históricos de solo lectura, no autoridades de escritura.

## Quality / cuota

Los 2.000 minutos incluidos de GitHub Actions están consumidos. El workflow está optimizado para PRs draft: Quality #2433 confirmó `skipped` antes de asignar runner. El PR permanece draft durante la auditoría gratuita. Al reiniciarse la cuota, se marcará Ready y una ejecución funcional/verde podrá promover F001–F005 a `Verified`.
