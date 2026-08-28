# M3.3 F010 — Persistence / sync

Estado: **Ready for Quality — no Verified**.

## Audit
La persistencia de Inventory tenía cinco riesgos transversales: `inventoryMovements` podía recibir deletes/tombstones pese a ser evidencia append-only; los receipts de commands no eran durables; la hidratación de Product/Lot/Movement no demostraba causalidad tenant-aware; los lotes legacy sin `unit` no tenían una política de transición basada en evidencia; y deletes/merge por ID podían dejar huérfanos o destruir homónimos legacy ambiguos.

## Fix
- `inventoryMovements` e `inventoryCommandReceipts` son append-only en sync; deletes salientes y tombstones remotos fallan cerrado.
- `inventoryCommandReceipts` participa en `SYNCABLE_COLLECTIONS` y usa `inventoryReceiptPersistence.js` para identidad `(organizationId, commandId)`, firma durable, replay idempotente y colisión fail-closed.
- `inventoryHydrationAuthority.js` hace staging de Product/Lot/Movement y valida después la cadena Product → Lot → Movement dentro del tenant activo, incluso si las filas remotas llegan fuera de orden.
- `20260828010500_inventory_legacy_lot_unit_evidence.sql` solo completa `InventoryLot.unit` cuando el propio kardex histórico demuestra una única unidad consistente. Sin evidencia, no inventa backfill; contradicciones fallan cerrado.
- `inventoryDeletionAuthority.js` valida el estado final de un lote de sync: Product no puede desaparecer mientras sobreviva un Lot causal, y Lot no puede desaparecer mientras sobreviva un Movement append-only. Product+Lot sin movimientos pueden eliminarse juntos de forma atómica.
- Inventario legacy sin `organizationId` no se adopta implícitamente por el tenant activo. Upserts/deletes salientes y filas remotas ownerless fallan cerrado, y un homónimo local ownerless no puede ser reemplazado ni borrado por coincidencia de ID.

## Test / Re-Audit
Evidencia principal:
- `tests/m3-3-inventory-persistence-sync.test.mjs`
- `tests/m3-3-inventory-receipt-persistence.test.mjs`
- `tests/m3-3-inventory-hydration-authority.test.mjs`
- `tests/m3-3-inventory-legacy-unit-migration.test.mjs`
- `tests/m3-3-inventory-sync-legacy-ownership.test.mjs`

La reauditoría aislada de `inventoryDeletionAuthority.js` verificó tres propiedades: Product delete con Lot dependiente falla; Lot delete con Movement dependiente falla; Product+Lot unused pueden eliminarse conjuntamente preservando un homónimo foreign-tenant.

## Quality
Pendiente. El HEAD técnico de F010 no tiene GitHub Actions workflow run asociado, por lo que **no existe runner real ni steps ejecutados**. F010 no se marca Verified hasta Quality real.
