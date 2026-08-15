# Nexora One — Auditoría Forense v3 · M2.2 Growing Medium Engine

Estado: **BASELINE — auditoría abierta**
Base certificada: `main` merge M0→M2.1, commit `8bbed565dfb2cd546579e5a29a452b5ab5c1b313`, Quality #1759 verde.
Normativa: `docs/NEXORA_DOMAIN_MODEL_V1.md`.
Método: Audit → Fix → Test → Quality Gate → Re-Audit → Close.

## Alcance

M2.2 audita y sanea la autoridad de medios de cultivo antes de entrar a Irrigation/MIRFE:

- GrowingMediumProduct;
- GrowingMediumFormula;
- GrowingMediumBatch;
- GrowingMediumAssignment;
- ReusePolicy;
- ReuseCycle;
- PurchaseRequirement;
- coco, turba, tierra, mezclas, jiffy, plug y medios personalizados;
- volumen, lote proveedor, costo, reutilización, reposición y compra;
- tenancy, command boundary, eventos, Passport/Graph e inventario.

## Hallazgos iniciales reproducibles

| ID | Sev. | Estado | Área | Hallazgo |
|---|---:|---|---|---|
| M22-F001 | P0 | Open | Domain authority | No existe una autoridad `GrowingMediumProduct/Formula/Batch/Assignment`; producción y propagación guardan el medio como texto embebido (`growingMedium`, `substrate`, `mediumLot`). |
| M22-F002 | P0 | Open | Production assignment | `BedManager` replica `growingMedium` como string en cama y cada Position. No existe asignación durable con producto/fórmula/lote/volumen/costo/ciclo de reutilización ni ownership independiente. |
| M22-F003 | P0 | Open | Propagation assignment | `PropagationBankManager` guarda por bandeja `substrate`, jiffy/plug, volumen y `mediumLot` como campos libres; no demuestra producto/lote tenant-owned ni trazabilidad de proveedor/costo. |
| M22-F004 | P1 | Open | Formula/versioning | No existe `GrowingMediumFormula` versionada para mezclas configurables ni composición porcentual. “Mezcla” es una etiqueta, no una fórmula auditable. |
| M22-F005 | P0 | Open | Reuse lifecycle | No existe `ReusePolicy`/`ReuseCycle`; no hay autoridad para número máximo de usos, reposición parcial 30/70 configurable, renovación total ni alerta de fin de ciclo. |
| M22-F006 | P1 | Open | Purchase planning | No existe `PurchaseRequirement`; el sistema calcula litros configurados de forma local, pero no convierte asignaciones + política de reposición + rendimiento/proveedor en requerimiento de compra por sede/nave/cama. |
| M22-F007 | P1 | Open | Cost/provenance | El medio no conserva de forma canónica lote de proveedor, costo unitario/total, proveedor, fecha de recepción ni enlace a InventoryLot; por tanto costo por planta/ciclo no es reproducible. |
| M22-F008 | P1 | Open | Command/events | Cambiar medio en cama o bandeja ocurre dentro del command de infraestructura, sin command/eventos específicos de `GrowingMediumAssignment`, por lo que la historia técnica del sustrato queda mezclada con la historia física del espacio. |
| M22-F009 | P1 | Open | Passport/Graph | Passport/Knowledge Graph no tienen una relación canónica planta/Position → GrowingMediumAssignment → Batch/Product/Formula/ReuseCycle; la evidencia agronómica del medio no forma parte del Digital Twin. |

## Evidencia de baseline

### Producción

`src/components/BedManager.jsx`:
- `emptyBed(... growingMedium:'Coco')`;
- selector de texto Coco/Turba/Tierra/Mezcla/Otro;
- `createProductionPositions(... growingMedium)` copia el string a cada Position;
- no existe batch, assignment, cost ni reuse cycle.

`src/domain/facilityEngine.js`:
- `defaultContainerProfile()` solo referencia opcionalmente `growingMediumId`;
- `createProductionPositions()` sigue materializando `growingMedium` como string.

### Propagación

`src/components/PropagationBankManager.jsx`:
- `substrate`, `usesJiffy`, `plugType`, `plugSize`, `volumePerCavityMl`, `mediumLot` viven dentro del tray;
- el volumen total se calcula para UI, pero no crea una asignación ni consumo de lote;
- `mediumLot` es texto libre.

### Modelo normativo

`docs/NEXORA_DOMAIN_MODEL_V1.md` exige explícitamente:
- GrowingMediumProduct;
- GrowingMediumFormula;
- GrowingMediumBatch;
- GrowingMediumAssignment;
- ReusePolicy;
- ReuseCycle;
- PurchaseRequirement;
- soporte para coco/turba/tierra/mezclas/jiffy/plug/personalizados;
- volumen, lote proveedor, costo y ciclo de reutilización por asignación.

## Criterios de cierre

1. Producto/fórmula/batch/assignment tenant-owned y con identidad estable.
2. Producción y propagación referencian asignaciones canónicas, no strings como autoridad.
3. Fórmulas de mezcla versionadas, suma de composición validada y no destructivas.
4. Batch conserva proveedor, lote proveedor, costo, volumen/cantidad y enlace opcional a inventario.
5. ReusePolicy configurable por organización/producto/uso; sin hardcode universal de 30/70 o 3 ciclos.
6. ReuseCycle registra uso, volumen recuperado, reposición, pérdida, renovación total y responsable.
7. PurchaseRequirement reproducible por sede/nave/cama/periodo y basado en volumen real + política + rendimiento.
8. Mutaciones pasan por command/action boundary con permiso, tenant, idempotencia y eventos canónicos.
9. Passport/Graph pueden explicar qué medio/lote/fórmula/ciclo recibió una planta o Position.
10. Pruebas adversariales cross-tenant, lote agotado, fórmula inválida, retry, sobreasignación y ciclo excedido.
11. Quality completo verde.
12. Reauditoría independiente sin P0/P1 abiertos.

## Conteo inicial

- Open: **9**
- P0: **4**
- P1: **5**
- Closed: **0**
