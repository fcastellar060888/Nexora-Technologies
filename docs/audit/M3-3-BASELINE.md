# Nexora One — Auditoría Forense v3 · M3.3 Inventory

Estado: **AUDIT IN PROGRESS — 0/12 Verified**  
Base apilada: M3.2 MIPE candidate `0895f6ed410e042dbc081e450c11d024e81b4cb5` (**uncertified: F010–F012 Ready for Quality**).  
Método obligatorio: Audit → Fix → Test → Quality → Re-Audit → Close.

> M3.3 puede avanzar técnicamente mientras GitHub Actions no asigna runners, pero ningún hallazgo se marcará Verified sin Quality real con steps ejecutados. M3.2 permanece congelado y no se modifica desde esta rama.

## Alcance
Inventario se audita como autoridad transversal para MIPE, MIRFE y operación: Product → InventoryLot → InventoryMovement → balance/costo → consumo causal, incluyendo tenancy, permisos, command boundary, idempotencia, concurrencia, trazabilidad, expiración, unidades, persistencia/sync, UI y proyección a Passport/Knowledge Graph.

## Hallazgos
| ID | Sev. | Estado | Área | Resultado / riesgo pendiente |
|---|---:|---|---|---|
| M33-F001 | P0 | **Ready for Quality** | Domain authority | Lot/Movement ahora llevan ownership explícito; resolución tenant-aware y fail-closed ante homónimos/duplicados. Falta Quality real. |
| M33-F002 | P0 | **Ready for Quality** | Tenancy | Product/Lot/Movement tienen scope/merge tenant-aware; UI de Inventario consume exclusivamente la partición activa. Falta Quality real. |
| M33-F003 | P0 | **Open** | Command boundary / permissions | Crear Product/Lot usa writes directos; faltan command, permisos requested→commit y receipts. |
| M33-F004 | P0 | **Open** | Ledger invariants | Saldo sigue materializado en `lot.quantity`; falta demostrar kardex append-only como autoridad verificable. |
| M33-F005 | P0 | **Open** | Concurrency | Fuera del RPC MIPE, dos clientes pueden competir sobre el mismo saldo. |
| M33-F006 | P1 | **Open** | Product/Lot causality | Falta cerrar compatibilidad de unidad y autoridad técnica Product→Lot. |
| M33-F007 | P1 | **Open** | Movement causality | Falta snapshot costo/unidad y causalidad verificable sourceType/sourceId. |
| M33-F008 | P1 | **Open** | Expiry / restrictions | Falta bloqueo de consumo vencido y baja/vencimiento append-only. |
| M33-F009 | P1 | **Open** | Cost integration | Falta consecuencia de costo auditable por movimientos operativos. |
| M33-F010 | P1 | **Open** | Persistence / sync | Falta ownership/merge/tombstones/idempotencia durable bajo sync. |
| M33-F011 | P1 | **Open** | UI / context | Falta cerrar contexto membership-aware Empresa→Sede y command surfaces; la lectura de Inventario ya está tenant-scoped por F002. |
| M33-F012 | P1 | **Open** | Adversarial / Passport | Falta reauditoría transversal y Product→Lot→Movement→Cost/MIPE/MIRFE en Passport/KG. |

## M33-F001 — Ready for Quality
### Audit
`src/domain/inventory.js` resolvía `inventoryLots.find(id)` globalmente, creaba Lot/Movement sin `organizationId` y permitía que un ID homónimo cross-tenant seleccionara/mutara evidencia extranjera.

### Fix
- `transactInventory()` resuelve organización activa y selecciona Lot/Product/Site por ownership causal.
- Identidad duplicada same-tenant falla cerrado; un homónimo cross-tenant no participa en la resolución.
- Movement congela `organizationId`; Lot nuevo congela `organizationId` y rechaza ownership hostil enviado por cliente.
- La mutación del saldo usa identidad de objeto ya resuelta, evitando modificar por ID los homónimos extranjeros.
- `createInventoryLot()` valida Product y Site dentro de la empresa activa y la unicidad de número de lote solo dentro del tenant.

### Test
`tests/m3-3-inventory-domain-tenancy.test.mjs` agrega cobertura adversarial para: homónimo Lot/Product cross-tenant, sede extranjera, `organizationId` hostil, ownership de saldo inicial y duplicado same-tenant fail-closed.

### Re-Audit
El borde F001 ya no depende de ID global para Lot/Product/Site. F001 no absorbe F002/F006: scope UI/merge y compatibilidad técnica de unidades permanecen hallazgos separados.

### Quality
**Pendiente por indisponibilidad de runner.** Estado correcto: Ready for Quality, no Verified.

## M33-F002 — Ready for Quality
### Audit
La autoridad de dominio ya podía resolver ownership, pero las superficies seguían leyendo `state.products`, `state.sites` y `state.inventoryLots` globalmente. Eso permitía exposición visual de homónimos cross-tenant aunque los writes de F001 fallaran cerrado.

### Fix
- `src/domain/inventoryTenancy.js` define ownership causal para Product/Lot/Movement, `scopeInventoryState()` y `mergeInventoryState()`.
- Lot solo pertenece al tenant si resuelve exactamente un Product del mismo tenant.
- Movement solo pertenece al tenant si resuelve Lot y Product causales coherentes y no contradice sede.
- `mergeInventoryState()` reemplaza únicamente la partición activa, preserva registros extranjeros y rechaza duplicados same-tenant.
- `InventoryPage` deriva `inventory=scopeInventoryState(state)` y usa esa partición para selects de Product/Site y tabla de existencias.
- La key de lote en UI incluye `organizationId:id`, evitando colisión React ante homónimos válidos cross-tenant.

### Test
- `tests/m3-3-inventory-tenancy-scope.test.mjs`: homónimos cross-tenant, referencias causales contradictorias, scope, merge preservando extranjeros y duplicado same-tenant fail-closed.
- `tests/m3-3-inventory-tenancy-ui.test.mjs`: prohíbe regresar a lecturas globales de Product/Site/Lot en `InventoryPage`.

### Re-Audit
El scope operativo de lectura y el merge de partición quedan tenant-aware. Persistencia/sync durable, tombstones y replay remoto permanecen deliberadamente en F010; command boundary y permisos permanecen en F003. No se atribuyen a F002.

### Quality
**Pendiente por indisponibilidad de runner.** Estado correcto: Ready for Quality, no Verified.

## Orden siguiente
1. F003 — command boundary + permisos + receipts.
2. F004/F005 — ledger append-only y concurrencia atómica.
3. F006–F009 — causalidad/unidades/vencimiento/costos.
4. F010/F011 — persistencia/sync/context/UI.
5. F012 — adversarial transversal + Passport/KG.

No modificar `main`. No certificar M3.3 ni alterar el estado de M3.2 hasta disponer de GitHub Actions funcional.