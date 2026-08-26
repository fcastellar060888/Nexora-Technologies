# Nexora One — Auditoría Forense v3 · M3.3 Inventory

Estado: **AUDIT IN PROGRESS — 0/12 Verified**  
Base apilada: M3.2 MIPE candidate `0895f6ed410e042dbc081e450c11d024e81b4cb5` (**uncertified: F010–F012 Ready for Quality**).  
Método obligatorio: Audit → Fix → Test → Quality → Re-Audit → Close.

> M3.3 puede avanzar técnicamente mientras GitHub Actions no asigna runners, pero ningún hallazgo se marcará Verified sin Quality real con runner y steps ejecutados. M3.2 permanece congelado y no se modifica desde esta rama.

## Alcance
Inventario se audita como autoridad transversal para MIPE, MIRFE y operación: Product → InventoryLot → InventoryMovement → balance/costo → consumo causal, incluyendo tenancy, permisos, command boundary, idempotencia, concurrencia, trazabilidad, expiración, unidades, persistencia/sync, UI y proyección a Passport/Knowledge Graph.

## Hallazgos
| ID | Sev. | Estado | Área | Resultado / riesgo pendiente |
|---|---:|---|---|---|
| M33-F001 | P0 | **Ready for Quality** | Domain authority | Lot/Movement llevan ownership explícito; resolución tenant-aware y fail-closed ante homónimos/duplicados. Falta Quality real. |
| M33-F002 | P0 | **Ready for Quality** | Tenancy | Product/Lot/Movement tienen scope/merge tenant-aware; UI consume la partición activa. Falta Quality real. |
| M33-F003 | P0 | **Ready for Quality** | Command boundary / permissions | Product/Lot pasan por command boundary, `manage_inventory`, receipts tenant-aware y revalidación requested→commit. Falta Quality real. |
| M33-F004 | P0 | **Ready for Quality** | Ledger invariants | Kardex append-only es autoridad verificable del saldo y los writes validan continuidad/cadena causal. Falta Quality real. |
| M33-F005 | P0 | **Ready for Quality** | Concurrency | Movimiento manual usa commit remoto atómico por tenant+lote, versión/cabeza/saldo y winner/loser. Falta Quality real. |
| M33-F006 | P1 | **Ready for Quality** | Product/Lot causality | Product gobierna unidad técnica; Product inválido no entra por command y Lot nuevo congela unidad derivada. Contradicciones fallan cerrado. Falta Quality real. |
| M33-F007 | P1 | **Open** | Movement causality | Falta snapshot costo/unidad y causalidad verificable sourceType/sourceId. |
| M33-F008 | P1 | **Open** | Expiry / restrictions | Falta bloqueo de consumo vencido y baja/vencimiento append-only. |
| M33-F009 | P1 | **Open** | Cost integration | Falta consecuencia de costo auditable por movimientos operativos. |
| M33-F010 | P1 | **Open** | Persistence / sync | Falta ownership/merge/tombstones/idempotencia durable bajo sync. |
| M33-F011 | P1 | **Open** | UI / context | Falta reauditar contexto membership-aware transversal. |
| M33-F012 | P1 | **Open** | Adversarial / Passport | Falta reauditoría transversal y Product→Lot→Movement→Cost/MIPE/MIRFE en Passport/KG. |

## M33-F001 — Ready for Quality
`src/domain/inventory.js` resuelve Lot/Product/Site dentro de la empresa activa; Lot/Movement congelan ownership y homónimos cross-tenant no contaminan la mutación. Duplicados same-tenant fallan cerrado. Evidencia: `tests/m3-3-inventory-domain-tenancy.test.mjs`.

## M33-F002 — Ready for Quality
`src/domain/inventoryTenancy.js` define ownership causal, `scopeInventoryState()` y `mergeInventoryState()`. `InventoryPage` y `InventoryMovementsPage` consumen scope tenant-aware; el merge reemplaza solo la partición activa. Evidencia: `tests/m3-3-inventory-tenancy-scope.test.mjs`, `tests/m3-3-inventory-tenancy-ui.test.mjs` y contrato UI F005.

## M33-F003 — Ready for Quality
`src/services/inventoryCommand.js` introduce `CREATE_PRODUCT` / `CREATE_LOT`, `manage_inventory`, receipts `(organizationId, commandId)`, firma estable, replay efecto-único y revalidación TOCTOU. `InventoryPage` no puede escribir Product/Lot directamente. Evidencia: `tests/m3-3-inventory-command.test.mjs` y `tests/m3-3-inventory-command-ui.test.mjs`.

## M33-F004 — Ready for Quality
`src/domain/inventoryLedger.js` reconstruye saldo desde el kardex, valida `balanceBefore`, aritmética, `balanceAfter`, `ledgerSequence` y `previousMovementId`. `transactInventory()` deriva el saldo desde esa autoridad y materializa bootstrap legacy determinista cuando corresponde. Evidencia: `tests/m3-3-inventory-ledger-invariants.test.mjs` y `tests/m3-3-inventory-ledger-write-authority.test.mjs`.

## M33-F005 — Ready for Quality
### Audit
Dos clientes podían partir de la misma versión/cabeza/saldo y construir movimientos localmente válidos. `InventoryMovementsPage` además tenía write directo.

### Fix
- `RECORD_MOVEMENT` entra por command boundary con `manage_inventory` y receipt tenant-aware.
- `inventoryMovementTransaction.js` limita la unidad atómica a Lot + Movement(s) y exige confirmación remota canónica antes del commit local/completion.
- `commit_inventory_movement()` serializa por `(organizationId, lotId)`, usa `FOR UPDATE`, revalida permisos/sede, `_syncVersion`, cabeza, saldo y cadena append-only.
- Idempotencia remota durable `(organization_id, command_id)` + firma.
- El caso legacy valida server-side toda la arista bootstrap→manual.
- `InventoryMovementsPage` ya no usa write local ni colecciones globales.

### Test / Re-Audit
`tests/m3-3-inventory-concurrency.test.mjs` cubre precondición común de dos clientes, lock/version/ledger conflicts, continuidad legacy en PostgreSQL y prohibición de regresar al write local. Expediente: `docs/audit/M3-3-F005-CONCURRENCY.md`.

### Quality
**Pendiente por indisponibilidad de runner. Ready for Quality, no Verified.**

## M33-F006 — Ready for Quality
### Audit
La compatibilidad `doseUnit → inventory unit` vivía solo en `InventoryPage`; un caller directo podía crear Product técnicamente inválido. Los lotes no congelaban la unidad técnica del Product, por lo que Product→Lot no era una relación verificable.

### Fix
- `src/domain/inventoryProductCausality.js` define unidades admitidas y compatibilidad técnica para categorías ejecutables MIPE/Biológico/Adyuvante.
- `CREATE_PRODUCT` ejecuta `assertInventoryProductTechnicalAuthority()` antes de emitir requested/commit effects; Product inválido falla sin mutación ni receipt.
- `createInventoryLot()` deriva `unit` exclusivamente desde Product mediante `inventoryLotUnitFromProduct()` y rechaza cualquier override contradictorio.
- El evento `inventory.lot.created` congela también la unidad derivada.
- `transactInventory()` falla cerrado si un Lot persistido que ya tiene `unit` contradice al Product.
- Compatibilidad legacy: un Lot histórico sin `unit` puede seguir operando sin inventar evidencia retroactiva; ningún Lot nuevo puede nacer sin unidad. La migración durable/backfill de registros históricos permanece dentro del alcance de F010 y no se confunde con la autoridad de nuevos writes de F006.

### Test
`tests/m3-3-inventory-product-lot-causality.test.mjs` cubre:
- Product MIPE/Biológico incompatible;
- override hostil de unidad de Lot;
- contradicción Product↔Lot persistida;
- rechazo desde `CREATE_PRODUCT` antes de efectos;
- creación Product→Lot por command con unidad congelada;
- rechazo de Lot hostil por command;
- fallo de movimiento ante Lot contradictorio;
- autoridad directa de `createInventoryLot()` fuera de UI.

Fixtures anteriores de F001/F003/F004 fueron actualizados para aportar unidades técnicamente válidas sin debilitar sus adversariales.

### Re-Audit
La validación ya no depende de UI: Product y Lot tienen autoridad de dominio/command. La excepción legacy es explícita y no permite crear nueva deuda; su backfill/persistencia se auditará en F010. F006 no absorbe todavía snapshots de costo/unidad en cada Movement, que pertenecen a F007.

### Quality
**Pendiente por indisponibilidad de runner. Ready for Quality, no Verified.**

## Orden siguiente
1. F007 — snapshot costo/unidad y causalidad `sourceType/sourceId` por Movement.
2. F008–F009 — vencimiento/restricciones y costos.
3. F010/F011 — persistencia/sync/backfill legacy/context/UI.
4. F012 — adversarial transversal + Passport/KG.

No modificar `main`. No certificar M3.3 ni alterar el estado de M3.2 hasta disponer de GitHub Actions funcional.
