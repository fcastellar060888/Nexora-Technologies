# Nexora One — Auditoría Forense v3 · M3.3 Inventory

Estado: **AUDIT IN PROGRESS — 0/12 Verified**  
Base apilada: M3.2 MIPE candidate `0895f6ed410e042dbc081e450c11d024e81b4cb5` (**uncertified: F010–F012 Ready for Quality**).  
Método obligatorio: Audit → Fix → Test → Quality → Re-Audit → Close.

> M3.3 puede avanzar técnicamente mientras GitHub Actions no asigna runners, pero ningún hallazgo se marcará Verified sin Quality real con steps ejecutados. M3.2 permanece congelado y no se modifica desde esta rama.

## Alcance

Inventario se audita como autoridad transversal para MIPE, MIRFE y operación: Product → InventoryLot → InventoryMovement → balance/costo → consumo causal, incluyendo tenancy, permisos, command boundary, idempotencia, concurrencia, trazabilidad, expiración, unidades, persistencia/sync, UI y proyección a Passport/Knowledge Graph.

## Hallazgos iniciales

| ID | Sev. | Estado | Área | Riesgo / evidencia inicial |
|---|---:|---|---|---|
| M33-F001 | P0 | **Open** | Domain authority | `src/domain/inventory.js` resuelve lotes por `id` global y crea Movement/Lot sin `organizationId`; un homónimo cross-tenant puede resolver el registro incorrecto. |
| M33-F002 | P0 | **Open** | Tenancy | `InventoryPage` consume `state.products`, `state.sites` e `state.inventoryLots` globales; la tabla y selectores no están scoped al tenant/sede activos. |
| M33-F003 | P0 | **Open** | Command boundary / permissions | Crear Product y Lot usa `update(...)` directo; no existe command explícito, permiso revalidado requested→commit ni receipt idempotente. |
| M33-F004 | P0 | **Open** | Ledger invariants | `transactInventory()` confía en `lot.quantity` como saldo mutable y genera IDs/fechas localmente; falta autoridad append-only del kardex y verificación de que balance = suma causal de movimientos. |
| M33-F005 | P0 | **Open** | Concurrency | Dos clientes pueden leer el mismo `quantity`, aprobar salidas independientes y producir lost update/consumo doble fuera del RPC específico de MIPE Treatment. |
| M33-F006 | P1 | **Open** | Product/Lot causality | `createInventoryLot()` valida solo presencia de `productId/siteId`; no prueba que Product y Site pertenezcan a la misma organización ni que la unidad del lote sea compatible con Product. |
| M33-F007 | P1 | **Open** | Movement causality | Movement hereda Product/Site del Lot, pero no congela snapshot técnico/costo/unidad ni exige `sourceType/sourceId` verificable para consumos operativos. |
| M33-F008 | P1 | **Open** | Expiry / operational restrictions | La UI muestra vencimiento, pero el dominio no bloquea consumo de lote vencido ni define semántica de baja/vencimiento como evidencia append-only. |
| M33-F009 | P1 | **Open** | Cost integration | El costo visible de Product es mutable; movimientos manuales no generan una consecuencia de costo auditable ni snapshot de costo por movimiento. |
| M33-F010 | P1 | **Open** | Persistence / sync | Falta demostrar ownership explícito, merge tenant-aware, tombstones permitidos/prohibidos e idempotencia durable de Lot/Movement/Product bajo sync. |
| M33-F011 | P1 | **Open** | UI / context | Formularios permiten elegir sedes/productos desde colecciones globales; no se ha demostrado membership-aware fail-closed ni contexto Empresa→Sede persistente. |
| M33-F012 | P1 | **Open** | Adversarial / Passport | Falta verificar homónimos cross-tenant, replay, carreras TOCTOU, unidades hostiles, lotes vencidos, negativos, doble consumo y trazabilidad Product→Lot→Movement→Cost/MIPE/MIRFE en Passport/KG. |

## Evidencia inicial confirmada

### `src/domain/inventory.js`

- `transactInventory()` selecciona `inventoryLots.find(item => item.id === input.lotId)` sin organización.
- Lot y Movement no reciben ownership explícito.
- El saldo se obtiene y reescribe desde `lot.quantity`; el movimiento se agrega después, por lo que hoy el kardex no es la única autoridad del balance.
- `createInventoryLot()` evita duplicados por `productId + siteId + lotNumber`, pero no incorpora organización ni resuelve causalmente Product/Site.
- IDs y timestamps se generan en el helper de dominio, lo que impide replay estable cuando la operación no pasa por un command receipt.

### `src/pages/InventoryPage.jsx`

- Product se crea con `update()` directo sobre `s.products`.
- Lot se crea con `update(s => createInventoryLot(s, lot))` directo.
- Selectores recorren `state.products` y `state.sites`; tabla recorre `state.inventoryLots` sin scope tenant-aware explícito.
- La validación técnica de Product vive en UI; todavía no existe una autoridad de dominio que impida bypass desde otra superficie.

## Orden de trabajo

1. F001 — introducir autoridad Inventory tenant-owned y tests de IDs homónimos.
2. F002 — scope/merge tenant-aware para Product/Lot/Movement.
3. F003 — command boundary + permisos + receipts.
4. F004/F005 — ledger append-only y concurrencia atómica.
5. F006–F009 — causalidad Product/Lot/unidades/vencimiento/costos.
6. F010/F011 — persistencia/sync/context/UI.
7. F012 — adversarial transversal + Passport/KG.

No modificar `main`. No certificar M3.3 ni alterar el estado de M3.2 hasta disponer de GitHub Actions funcional.
