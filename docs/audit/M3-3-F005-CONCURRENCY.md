# M33-F005 — Concurrency

Estado técnico: **Ready for Quality — no Verified**.

## Audit
`transactInventory()` protegía la integridad local del kardex, pero dos clientes podían partir del mismo `_syncVersion`, cabeza y saldo y construir movimientos válidos simultáneamente. `InventoryMovementsPage` además ejecutaba el write local directamente.

## Fix
- `RECORD_MOVEMENT` entra por `inventoryCommand.js` con `manage_inventory`, receipt tenant-aware y `prepareCommit` remoto antes del commit local/completion event.
- `inventoryMovementTransaction.js` limita la unidad atómica a exactamente un `inventoryLot` y uno o dos `inventoryMovements`, valida ownership, identidad, versión base, aritmética y cadena append-only, y solo aplica la confirmación remota canónica.
- `commit_inventory_movement()` serializa por `(organizationId, lotId)` mediante advisory xact lock y bloquea el lote remoto `FOR UPDATE`.
- El RPC revalida membership/`manage_inventory`/site, `_syncVersion`, Product/Site invariantes, saldo, cabeza del ledger, secuencia y predecessor antes de escribir.
- Idempotencia remota durable por `(organization_id, command_id)` + firma; colisiones de contenido fallan cerrado.
- Lote + movimiento(s) se escriben dentro de una sola transacción PostgreSQL.
- Para lote legacy, PostgreSQL exige bootstrap canónico y verifica explícitamente la arista bootstrap→manual: exactamente dos movimientos, `Manual`, `previousMovementId`, `ledgerSequence + 1` y `balanceBefore = bootstrap.balanceAfter`.
- `InventoryMovementsPage` ya no usa `useStore`, `update()` ni `transactInventory`; usa `useInventoryCommandStore()` + `RECORD_MOVEMENT` y scope tenant-aware.

## Test
`tests/m3-3-inventory-concurrency.test.mjs` cubre:
- dos clientes construyendo la misma precondición remota (`baseVersion`, cabeza, secuencia y saldo);
- contrato SQL de lock por tenant+lote, `FOR UPDATE`, version/ledger conflicts, permiso e idempotencia;
- continuidad legacy bootstrap→manual validada dentro del RPC;
- contrato UI que prohíbe regresar al write local o colecciones globales.

## Re-Audit
La carrera que F004 no podía resolver localmente queda serializada en PostgreSQL. El perdedor de dos clientes sobre el mismo snapshot no puede superar simultáneamente la versión/cabeza remota: después del primer commit, el segundo observa versión o cabeza divergente y falla con conflicto serializable antes de insertar su movimiento.

La confirmación remota se valida como conjunto exacto de identidades esperadas, tenant correcto, versión positiva y `updatedAt` válido antes de `applyRemoteRecords()`.

La persistencia/sync general, tombstones y reconciliación durable transversal permanecen deliberadamente en M33-F010; F005 no los absorbe.

## Quality
**Pendiente por indisponibilidad de runner.** No existe evidencia de GitHub Actions con runner + steps ejecutados para este checkpoint. Estado correcto: **Ready for Quality, no Verified**.
