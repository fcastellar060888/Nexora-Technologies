# M3.3 F012 — Adversarial / Passport / Knowledge Graph

Estado: **Ready for Quality — no Verified**.

## Audit
El cierre transversal exigía que la evidencia construida por F001–F011 pudiera proyectarse sin inferencias débiles ni referencias globales. La cadena requerida es:

`Product → InventoryLot → InventoryMovement → CostEntry`

con vínculo operativo explícito desde Movement hacia `MipeTreatment` o `MirfePreparation` cuando corresponda.

No existía una autoridad Inventory Passport dedicada que recompusiera esa cadena y fallara cerrado ante homónimos cross-tenant, economía adulterada o fuentes operativas ausentes.

La reauditoría posterior encontró tres clases adicionales de defecto forense: identidades duplicadas same-tenant podían quedar ocultas por la deduplicación final del grafo; un InventoryLot/InventoryMovement explícitamente perteneciente al tenant pero causalmente huérfano podía ser descartado por el filtrado de tenancy; y referencias legacy válidas de Lot/Movement sin `organizationId` explícito podían ser seleccionadas correctamente por `inventoryTenancy.js` pero luego rechazadas por el resolver interno del Passport, que volvía a exigir ownership explícito.

## Fix
Se añadió `src/domain/inventoryPassport.js`.

Propiedades:
- requiere `organizationId` explícito;
- Product/Lot/Movement entran y se resuelven por la causalidad de `inventoryTenancy.js`, no por ID global ni por `organizationId` explícito como segunda autoridad contradictoria;
- el Passport completo falla cerrado si un Lot declarado same-tenant no tiene Product causal válido o si un Movement declarado same-tenant no tiene una cadena Lot→Product válida;
- preserva evidencia legacy válida cuyo tenant se demuestra causalmente mediante sede/Product aunque Lot o Movement no tengan `organizationId` explícito;
- Product/Lot/Movement/CostEntry requieren identidad explícita y única dentro del tenant;
- proyecta aristas `PRODUCT_HAS_LOT`, `LOT_HAS_MOVEMENT`, `MOVEMENT_BACKS_COST` y `MOVEMENT_EXECUTED_BY`;
- Movement aporta al Passport la evidencia histórica congelada: cantidad, signo, balance before/after, secuencia/predecesor, unidad, `unitCost`, fecha y `sourceType/sourceId`;
- el costo histórico se deriva mediante `inventoryMovementCost()`; cambiar posteriormente `Product.cost` no revaloriza el pasado;
- CostEntry se vuelve a validar con `assertMovementBackedCostEntry()` y debe declarar el conjunto exacto de Movement IDs;
- CostEntry y Movements deben compartir fuente causal cuando `sourceType/sourceId` está declarado;
- `MipeTreatment` y `MirfePreparation` deben resolver una única entidad same-tenant; una fuente faltante o ambigua falla cerrado;
- CostEntries ajenos a Inventory y sin Movement IDs quedan fuera del grafo; MIPE/MIRFE sin evidencia de Movement fallan cerrado;
- en Passport completo, un CostEntry MIPE/MIRFE que solo apunte a evidencia extranjera/no causal falla en vez de desaparecer silenciosamente;
- un Passport filtrado por Product/Lot puede ignorar correctamente una cadena económica completa perteneciente íntegramente a otro subgrafo;
- nodos y aristas se ordenan determinísticamente para comparación/replay.

## Adversarial verification
`tests/m3-3-inventory-passport.test.mjs` cubre:
- MIPE happy path Product→Lot→Movement→CostEntry→Treatment;
- economía histórica independiente del precio mutable del Product;
- MIRFE agregado respaldado por múltiples Movements;
- contradicción Movement→Lot→Product;
- IDs homónimos cross-tenant;
- amount adulterado;
- CostEntry MIPE/MIRFE sin Movement evidence;
- CostEntry no-Inventory legítimo fuera del subgrafo;
- Movement IDs duplicados, faltantes o parcialmente fuera del subgrafo;
- source mismatch;
- fuente MIPE/MIRFE inexistente;
- orden determinista.

`tests/m3-3-inventory-passport-transversal.test.mjs` añade:
- costo MIPE detached/cross-tenant en Passport completo → fail-closed;
- Passport filtrado preserva aislamiento entre Products sin considerar como error una cadena válida perteneciente a otro Product;
- duplicados same-tenant de Product, Lot, Movement y CostEntry → fail-closed incluso si las filas son idénticas;
- InventoryLot same-tenant huérfano → fail-closed en Passport completo;
- InventoryMovement same-tenant sin Lot o con Product contradictorio → fail-closed en Passport completo;
- Lot y Movement legacy sin `organizationId` explícito se preservan cuando su tenant se resuelve causalmente por sede/Product.

La reauditoría transversal conserva además como evidencia obligatoria las baterías específicas F001–F011: domain/tenancy, command/permissions, ledger, concurrency, Product/Lot causality, Movement causality, expiry, cost integration, persistence/sync y UI/context. F012 no reemplaza esos contratos; demuestra que su evidencia compone un grafo verificable.

## Certification boundary
M3.3 queda técnicamente con **F001–F012 Ready for Quality y 0/12 Verified**. Esta afirmación es de completitud técnica, no de certificación.

**F012 no puede marcarse Verified sin GitHub Actions Quality con runner real y steps ejecutados.** La misma regla sigue aplicando a F010 y F011.
