# M3.3 F009 — Cost integration

Estado: **Ready for Quality — no Verified**.

## Audit
MIPE y MIRFE podían calcular CostEntry desde precios/snapshots distintos de la evidencia económica congelada en InventoryMovement. CostEntry tampoco demostraba qué movimientos justificaban el importe.

## Fix
- `inventoryCostAuthority.js` deriva costo exclusivamente como `abs(quantity) * unitCost` desde InventoryMovement.
- MIPE usa `movementBackedCostEntry()` sobre el Movement exacto materializado y conserva `inventoryMovementId`/`inventoryMovementIds` y causalidad `MipeTreatment`.
- MIRFE usa `movementsBackedCostEntry()` sobre el conjunto exacto de movimientos materializados, conserva sus IDs y causalidad `MirfePreparation`; `tankPreparation.totalCost` toma exactamente `CostEntry.amount`.
- `20260827121000_inventory_cost_evidence_guard.sql` instala constraint trigger diferido: resuelve Movement IDs dentro del mismo tenant, rechaza duplicados/faltantes, recalcula amount desde economía congelada, valida causalidad y congela evidencia histórica.
- MIPE/MIRFE fallan cerrado server-side si intentan persistir CostEntry sin evidencia de movimientos.

## Test / Re-Audit
- `m3-3-inventory-cost-authority.test.mjs`: precio posterior no revaloriza, agregado MIRFE, duplicados/cross-tenant, amount adulterado.
- `m3-3-inventory-cost-evidence-guard.test.mjs`: guard diferido, same-tenant, recomputación, causalidad e inmutabilidad.
- `m3-3-inventory-cost-integration.test.mjs`: contratos productivos MIPE/MIRFE enlazados a los movimientos materializados y prohibición de volver al recálculo independiente.

## Quality
Pendiente por indisponibilidad de runner. **Ready for Quality, no Verified.**
