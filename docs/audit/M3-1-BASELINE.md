# Nexora One — Auditoría Forense v3 · M3.1 Irrigation & MIRFE

Estado: **BASELINE — auditoría abierta**  
Base certificada: M2.2 Growing Medium Engine, head `d35a452612cada20cfd58a53599054a4dfe00b76`, Quality #1842 verde.  
Bloque de arquitectura: M3 — Agronomy Operational (`MIRFE + MIPE + Inventory integration`).  
Normativa: `docs/NEXORA_DOMAIN_MODEL_V1.md` + `docs/NEXORA_PRODUCT_DOCTRINE.md`.  
Método: Audit → Fix → Test → Quality Gate → Re-Audit → Close.

## Alcance M3.1

Este subbloque toma primero la frontera Irrigation/MIRFE que sigue a Growing Medium e incluye las dependencias que condicionan su integridad:

- IrrigationEmitter, IrrigationAssignment, IrrigationSector e IrrigationPulse;
- IrrigationMeasurement y DrainageMeasurement;
- FertigationProduct, FertigationFormula, FertigationPreparation y FertigationApplication;
- análisis de agua, objetivos nutricionales, formulación, preparación, aplicación, monitoreo y correcciones;
- SensorDevice, ControllerDevice y fuente de medición;
- integración de consumo/costo con Inventory;
- tenancy, permisos, command boundary, eventos, persistencia, sync, Timeline, Passport y Knowledge Graph.

MIPE conserva su funcionalidad histórica durante M3.1 y se auditará como subbloque separado de M3 después de cerrar estas autoridades.

## Hallazgos iniciales reproducibles

| ID | Sev. | Estado | Área | Hallazgo |
|---|---:|---|---|---|
| M31-F001 | P0 | **Verified** | Domain authority | `src/domain/irrigationMirfe.js` establece entidades inmutables y tenant-owned para Emitter/Sector/Assignment/Pulse/Measurement/Drainage y Product/Formula/Preparation/Application MIRFE. Quality #1847. |
| M31-F002 | P0 | Open | Tenancy | Planes, fórmulas, preparaciones, aplicaciones, análisis, objetivos y productos carecen de `organizationId`; dominio y UI buscan/mutan por `id` o `siteId` simple. IDs repetidos entre empresas pueden cruzar lecturas y mutaciones. |
| M31-F003 | P0 | Open | Command/events | Las pantallas Irrigation/MIRFE llaman `update()` directamente. No existe command/action boundary tenant-aware e idempotente ni publicación efectiva de intención/evento canónico para crear, aprobar, preparar o aplicar. |
| M31-F004 | P0 | Open | Irrigation topology | `hydraulics()` asume `plantas × drippers × caudal`; no representa anillo, gotero con varias estacas, gotero compartido, múltiples emisores, sectores, asignación por Position ni control manual/automático. |
| M31-F005 | P0 | Open | Formula/versioning | `calculateSimpleFormula()` reparte el objetivo mediante una heurística de suma global, no resuelve nutrientes por composición; una fórmula puede aprobarse aun con advertencias. No hay versión inmutable ni lineage de fórmula. |
| M31-F006 | P0 | Open | Execution/inventory | Preparación y aplicación resuelven formulación, producto, lote y preparación por ID simple; retry no es idempotente y una carrera puede descontar inventario dos veces. No existe durable intent ni evento causal de ejecución. |
| M31-F007 | P1 | Open | Tank/planning | La UI anuncia cargas máximas de 1.000 L pero acepta cualquier capacidad/volumen. El cálculo informa cargas, pero no persiste frecuencia de preparación ni divide un plan diario en preparaciones ejecutables. |
| M31-F008 | P1 | Open | Water authority | Los análisis de agua son registros planos creados desde React; no existe identidad de laboratorio/muestra/versión, soporte parcial, comparación histórica canónica ni ownership organizacional. |
| M31-F009 | P1 | Open | Environment/measurements | Targets ambientales se duplican dentro de cada lectura. No existen fuente `SENSOR/CONTROLADOR/MANUAL/MUESTRA/IMPORTADO/CALCULADO`, dispositivos, calibración, setpoints ni alertas canónicas. |
| M31-F010 | P1 | Open | Workflow/history | Programas, monitoreo, refuerzos, correcciones e historia mantienen estados y transiciones dentro de páginas; no hay workflow compartido ni Timeline/Ledger agronómico demostrable. |
| M31-F011 | P1 | Open | Persistence/sync | Las colecciones participan del sync genérico, pero los registros nuevos nacen sin ownership explícito y las pantallas no filtran por tenant. La infraestructura de sync no sustituye la validación de dominio ausente. |
| M31-F012 | P1 | Open | Passport/Graph/tests | Passport/Knowledge Graph no explican pulso, preparación, fórmula, lote consumido, aplicación, medición ni drenaje. MIRFE/formulation carecen de pruebas de dominio; las pruebas de ejecución no cubren tenant, retry, carreras, eventos o proyección. |

## M31-F001 — cierre verificado

### Solución

- `IrrigationEmitter` modela RING, STAKE, SHARED, MULTI y MANUAL con caudal, salidas, estacas y plantas servidas configurables.
- `IrrigationSector` y `IrrigationAssignment` separan sector, emisor y destino físico POSITION/BED/TRAY.
- `IrrigationPulse`, `IrrigationMeasurement` y `DrainageMeasurement` conservan volumen, tiempo, fuente canónica y evidencia numérica; drenaje deriva porcentaje sin aceptar volumen imposible.
- `FertigationProduct`, `FertigationFormula`, `FertigationPreparation` y `FertigationApplication` tienen identidad estable, ownership, snapshots y referencias explícitas.
- `nextFertigationFormulaVersion()` crea lineage inmutable sin reescribir la versión anterior.
- La composición entre entidades falla cerrado si organización o sede no coinciden; IDs repetidos entre tenants permanecen identidades distintas.

### Pruebas adversariales

`tests/m3-1-irrigation-mirfe-domain.test.mjs` cubre:

- IDs repetidos entre organizaciones;
- referencia Emitter/Sector cross-tenant;
- emisor compartido inválido y catálogos desconocidos;
- target y ventanas temporales inválidos;
- fuente de medición, valores no finitos y pulso completado sin volumen real;
- drenaje mayor que volumen aplicado;
- producto/composición inválidos y duplicados de fórmula;
- versionado, snapshot de preparación, sobreaplicación y preparación no lista.

### Quality y reauditoría

- Commit: `3c5cc8f8e413154ca05e61294575863eeb2725a1`.
- Quality #1847: **verde**, 843/843 pruebas.
- Cobertura de `irrigationMirfe.js`: líneas 100%, branches 69.72%, funciones 100%.
- Cobertura global: líneas 92.53%, branches 74.67%, funciones 90.39%.
- Reauditoría: las entidades son profundamente inmutables; referencias compuestas heredan tenant/sede de la autoridad y rechazan cruces. UI, commands, sync y proyecciones no se declaran cerrados aquí y permanecen en F002–F012.

## Evidencia de baseline

### Dominio actual

- `src/domain/irrigation.js`: cálculo agregado por camas; sin entidades, ownership ni eventos.
- `src/domain/mirfe.js`: tres funciones matemáticas sin contratos de entidad.
- `src/domain/formulation.js`: cálculo heurístico mutable y búsqueda de productos por ID simple.
- `src/domain/irrigationExecution.js`: crea/ejecuta/aplica sobre colecciones del Store y delega consumo a inventario sin tenant.
- `src/domain/inventory.js`: lote y movimiento se resuelven/mutan por ID simple y no llevan organización.

### UI y autorización

- Las rutas están protegidas por permisos, pero `IrrigationPlanPage`, `FormulationPage`, `PreparationsPage`, `IrrigationWorkflowPage`, Water/Nutrients y las páginas MIRFE escriben directamente mediante `update()`.
- Ninguna de esas páginas materializa `organizationId` ni filtra sus colecciones por la empresa activa.
- La autorización de ruta no protege el dominio frente a llamadas internas, retry o contextos inconsistentes.

### Pruebas y Quality

- Quality #1842 deja la base heredada completamente verde.
- `tests/irrigationExecution.test.mjs` cubre cinco casos legacy: conversión, preparación, consumo/costo, lote de otra sede y aplicación.
- No hay prueba adversarial de IDs repetidos cross-tenant, command replay, carrera de stock, evento/Ledger, persistencia remota o Passport/Graph para Irrigation/MIRFE.
- `mirfe.js`, `irrigation.js` y `formulation.js` no aparecen como autoridades cubiertas en el reporte de coverage del cierre M2.2.

## Criterios de cierre

1. Entidades Irrigation/MIRFE canónicas, tenant-owned y con identidad estable.
2. Topología configurable por planta/Position/sector para anillo, estacas, compartido y múltiples emisores.
3. Pulsos, mediciones y drenajes con fuente explícita, unidad, tiempo y ownership.
4. Fórmula versionada e inmutable; composición, unidades, solubilidad y compatibilidad validadas antes de aprobación.
5. Preparación/aplicación idempotentes, permission-aware y transaccionales con inventario/costo.
6. Límite de tanque configurable con máximo operativo de 1.000 L y frecuencia/preparaciones derivadas del plan.
7. Agua con laboratorio/muestra/versiones/parciales y comparación histórica.
8. Sensores/controladores/calibraciones/targets/alertas como autoridad, no campos repetidos de una lectura.
9. Mutaciones significativas por command/action boundary y eventos canónicos hacia Ledger/Timeline.
10. Persistencia y sync fail-closed con IDs repetidos entre organizaciones.
11. Passport/Knowledge Graph explican plan → fórmula → preparación → lote → aplicación → medición/drenaje.
12. Pruebas adversariales de tenant, retry, carrera, stock, unidades, sobrevolumen y referencias extranjeras.
13. Quality completo verde sin reducir umbrales.
14. Reauditoría independiente sin P0/P1 abiertos dentro de M3.1.

## Conteo inicial

- Open: **12**
- P0: **6**
- P1: **6**
- Closed: **0**

## Estado actual

- Verified: **1**
- Open: **11**
- P0 abiertos: **5**
- P1 abiertos: **6**
