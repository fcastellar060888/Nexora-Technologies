# Nexora One — Auditoría Forense v3 · M2.2 Growing Medium Engine

Estado: **VERIFIED — 9/9 hallazgos cerrados**
Base certificada: `main` merge M0→M2.1, commit `8bbed565dfb2cd546579e5a29a452b5ab5c1b313`.
Normativa: `docs/NEXORA_DOMAIN_MODEL_V1.md`.
Método: Audit → Fix → Test → Quality Gate → Re-Audit → Close.

## Alcance certificado

M2.2 establece una autoridad canónica y tenant-aware para:

- GrowingMediumProduct;
- GrowingMediumFormula y versionado inmutable;
- GrowingMediumBatch;
- GrowingMediumAssignment;
- ReusePolicy;
- ReuseCycle;
- PurchaseRequirement;
- producción y propagación;
- lote proveedor, costo, inventario, reutilización y compra;
- command boundary, eventos, sync, Passport y Knowledge Graph.

## Matriz final

| ID | Sev. | Estado | Área | Evidencia de cierre |
|---|---:|---|---|---|
| M22-F001 | P0 | Closed | Domain authority | `src/domain/growingMedium.js` define Product/Formula/Batch/Assignment con identidad estable y ownership organizacional. Quality #1766/#1776. |
| M22-F002 | P0 | Closed | Production assignment | `BedManager` dejó de crear `growingMedium` textual; camas/Positions referencian `GrowingMediumAssignment`. Operación target+assignment es atómica. Quality #1784/#1802. |
| M22-F003 | P0 | Closed | Propagation assignment | Bandejas nuevas ya no capturan `substrate`/`mediumLot` como autoridad; jiffy/plug permanecen como propiedades físicas y el medio se enlaza por Assignment. Quality #1790/#1802. |
| M22-F004 | P1 | Closed | Formula/versioning | Fórmulas validan composición 100%, tienen `formulaKey`, `version`, `supersedesFormulaId` y crean versiones nuevas sin reescribir historia. Quality #1812. |
| M22-F005 | P0 | Closed | Reuse lifecycle | `ReusePolicy` y `ReuseCycle` son entidades configurables; 30/70 y 3 usos son parámetros, no constantes universales. Quality #1766/#1776. |
| M22-F006 | P1 | Closed | Purchase planning | `PurchaseRequirement` persiste período, alcance SITE/HOUSE/BED/TRAY, snapshot de assignments/planes, reserva y litros requeridos; participa del sync tenant-aware. Quality #1826. |
| M22-F007 | P1 | Closed | Cost/provenance | Assignment congela supplier, supplierLot, inventoryLotId, costo unitario, moneda y costo total desde el batch; cambios posteriores del batch no alteran historia. Quality #1812. |
| M22-F008 | P1 | Closed | Command/events | Producto, fórmula, batch, assignment, reuse y purchase requirement pasan por command boundary idempotente con eventos canónicos. Quality #1776/#1826. |
| M22-F009 | P1 | Closed | Passport/Graph | Passport resuelve Assignment→Batch→Product/Formula→ReusePolicy/ReuseCycle por tenant y Knowledge Graph conserva relaciones/evidencia; referencias extranjeras fallan cerrado. Quality #1832. |

## Reauditoría independiente

### Autoridad y compatibilidad

- Nuevas camas no materializan `Coco/Turba/Tierra/Mezcla` como fuente de verdad.
- Nuevas bandejas no materializan `substrate` ni `mediumLot` como fuente de verdad.
- Los campos históricos pueden seguir leyéndose para compatibilidad/migración, pero no gobiernan nuevas asignaciones.
- La ruta `/growing-medium` está protegida por `manage_cultivation`.

### Tenancy e identidad

- Product, Formula, Batch, Assignment, ReusePolicy, ReuseCycle y PurchaseRequirement llevan `organizationId`.
- IDs históricos repetidos entre organizaciones se resuelven siempre con `(organizationId,id)`.
- Sync rechaza payloads extranjeros y `growingMediumPurchaseRequirements` participa del mismo contrato tenant-aware.
- Passport falla cerrado si una cama referencia un Assignment inexistente en la organización de la planta.

### Historia, costo y reutilización

- Una nueva versión de fórmula nunca sobrescribe la versión anterior.
- Assignment conserva snapshot de lote/proveedor/inventario/costo.
- ReuseCycle registra volumen reutilizado y fresco, acción y responsable.
- PurchaseRequirement conserva snapshot reproducible aun si luego cambian policy, batch o assignment.

### Digital Twin

La planta productiva puede explicar en Passport/Graph:

`Plant/Position → GrowingMediumAssignment → Batch → Product/Formula → ReusePolicy → ReuseCycle`

incluyendo volumen, lote proveedor, enlace de inventario, costo y ciclo de reutilización. Las relaciones usan nomenclatura canónica `growing.medium.*` y no proyectan nodos cross-tenant.

## Evidencia Quality

- #1766 — modelo de dominio: verde.
- #1776 — command boundary/eventos: verde.
- #1780 — sync inicial: verde.
- #1784 — asignación física atómica: verde.
- #1790 — pantalla/flujo operativo: verde.
- #1802 — eliminación de strings como autoridad en infraestructura: verde.
- #1812 — versionado y snapshots de costo/procedencia: verde.
- #1824 — rojo detectó una sustitución accidental incompleta de `syncEngine.js`; se corrigió restaurando el motor canónico y agregando únicamente PurchaseRequirement.
- #1826 — PurchaseRequirement + sync restaurado: verde.
- #1830 — rojo detectó nomenclatura inválida de `targetType` (`growing_medium.*`) en Passport; se corrigió al contrato `growing.medium.*`.
- #1832 — Passport/Graph F009 y todos los gates: verde.

## Diff re-audit contra main

- Estado: ahead, **0 behind**.
- 36 commits del bloque antes del cierre documental.
- 20 archivos modificados/agregados.
- `syncEngine.js`: únicamente una colección adicional frente al motor certificado.
- No se detectaron cambios fuera del alcance M2.2 que requieran reapertura.

## Resultado

- Hallazgos: **9**
- Closed/Verified: **9**
- P0 abiertos: **0**
- P1 abiertos: **0**
- Criterios de salida M2.2: **cumplidos**, sujeto al Quality final del commit documental de cierre.
