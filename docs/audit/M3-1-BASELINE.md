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
| M31-F002 | P0 | **Verified** | Tenancy | Planes, fórmulas, preparaciones, aplicaciones, análisis, objetivos y productos usan ownership explícito, vista/merge tenant-aware y resolución fail-closed. IDs repetidos entre empresas se preservan aislados. Quality #1853. |
| M31-F003 | P0 | **Verified** | Command/events | Nueve operaciones legacy pasan por un command boundary tenant-aware, permission-aware e idempotente; las siete páginas ya no mutan el Store. Intención y evento final usan IDs/causalidad deterministas. Quality #1857. |
| M31-F004 | P0 | Open | Irrigation topology | `hydraulics()` asume `plantas × drippers × caudal`; no representa anillo, gotero con varias estacas, gotero compartido, múltiples emisores, sectores, asignación por Position ni control manual/automático. |
| M31-F005 | P0 | Open | Formula/versioning | `calculateSimpleFormula()` reparte el objetivo mediante una heurística de suma global, no resuelve nutrientes por composición; una fórmula puede aprobarse aun con advertencias. No hay versión inmutable ni lineage de fórmula. |
| M31-F006 | P0 | Open | Execution/inventory | El replay con el mismo `commandId` ya es idempotente y publica intención/evento causal, pero falta transacción o precondición remota para dos comandos distintos concurrentes o ejecución multi-dispositivo; esa carrera todavía puede producir doble consumo o conflicto de stock. |
| M31-F007 | P1 | Open | Tank/planning | La UI anuncia cargas máximas de 1.000 L pero acepta cualquier capacidad/volumen. El cálculo informa cargas, pero no persiste frecuencia de preparación ni divide un plan diario en preparaciones ejecutables. |
| M31-F008 | P1 | Open | Water authority | Los análisis ya son tenant-owned, pero continúan como registros planos creados desde React; no existe identidad de laboratorio/muestra/versión, soporte parcial ni comparación histórica canónica. |
| M31-F009 | P1 | Open | Environment/measurements | Targets ambientales se duplican dentro de cada lectura. No existen fuente `SENSOR/CONTROLADOR/MANUAL/MUESTRA/IMPORTADO/CALCULADO`, dispositivos, calibración, setpoints ni alertas canónicas. |
| M31-F010 | P1 | Open | Workflow/history | Programas, monitoreo, refuerzos, correcciones e historia mantienen estados y transiciones dentro de páginas; no hay workflow compartido ni Timeline/Ledger agronómico demostrable. |
| M31-F011 | P1 | Open | Persistence/sync | Las colecciones legacy corregidas llevan ownership y usan el sync tenant-aware heredado, pero las nuevas entidades canónicas de F001 aún no están incorporadas al schema persistente, bootstrap y transporte remoto. |
| M31-F012 | P1 | Open | Passport/Graph/tests | Passport/Knowledge Graph no explican pulso, preparación, fórmula, lote consumido, aplicación, medición ni drenaje. La cobertura adversarial ya incluye dominio, tenant, replay, permisos y eventos; faltan carrera multi-dispositivo y proyección. |

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

## M31-F002 — cierre verificado

### Solución

- `src/domain/irrigationMirfeTenancy.js` resuelve identidad por organización y referencia causal, nunca por `id` global.
- `scopeIrrigationMirfeState()` construye una vista exclusiva de la empresa activa; `mergeIrrigationMirfeState()` reincorpora cambios sin borrar, sobrescribir ni reordenar semánticamente homónimos extranjeros.
- `useIrrigationMirfeCommandStore()` conserva esa vista tenant-aware para las siete superficies y ya no expone una función de mutación directa.
- `createTankPreparation()`, `executeTankPreparation()` y `registerIrrigationApplication()` ejecutan dentro de la misma frontera incluso cuando se invocan fuera de React.
- Los registros nuevos y derivados —movimiento de inventario, costo y orden— reciben `organizationId` explícito antes del commit al Store/sync.
- `stateMigration.js` eleva el esquema a v11 y solo backfillea ownership histórico cuando sede o referencia permiten una atribución inequívoca. Un registro ambiguo queda sin asignar y no es visible ni mutable en modo multiempresa.
- La decisión transversal está registrada en `docs/audit/ADR-M3-1-001-IRRIGATION-MIRFE-TENANCY.md`.

### Pruebas adversariales

- IDs idénticos de análisis, fórmulas, preparaciones, productos, lotes y órdenes en `org-a`/`org-b`;
- lectura y búsqueda restringidas al tenant activo;
- preservación del homónimo extranjero durante update, consumo y aplicación;
- rechazo de payload y referencias disponibles únicamente en otra empresa;
- migración causal segura y conservación fail-closed de registros históricos ambiguos;
- descuento exclusivo del lote activo y etiquetado de Movement/Cost/WorkOrder;
- compatibilidad histórica para instalaciones locales sin catálogo multiempresa;
- contrato estático que impide volver a conectar las siete superficies al Store global.

### Quality y reauditoría

- Commit de solución: `f441909aa8de8d10ae7656aeca45b2137853ddc1`.
- Quality #1851: rojo útil; las 10 pruebas M31-F002 pasaron y detectó dos aserciones históricas que fijaban schema 10.
- Commit de corrección de contrato de prueba: `cf6f77bed89c94b85a0783ef3282da21c97cc34a`.
- Quality #1853: **verde**, 854/854 pruebas; cobertura global 92.68% líneas, 75.01% ramas y 90.57% funciones.
- Cobertura: `irrigationMirfeTenancy.js` 98.77% líneas / 82.22% ramas / 100% funciones; `irrigationExecution.js` 100% líneas.
- Static, dependency, environment y session audits, functional evidence, coverage gate, production build y production artifact audit: verdes.
- Reauditoría del HEAD: las siete superficies consumen exclusivamente el hook tenant-aware; dominio, migración y merge fallan cerrado ante ambigüedad. F003 se verificó después en Quality #1857; F006 conserva la carrera transaccional y F011 la persistencia de entidades canónicas.

## M31-F003 — cierre verificado

### Solución

- `src/services/irrigationMirfeCommand.js` concentra nueve operaciones: plan, análisis de agua, producto, objetivo, fórmula borrador/aprobada, preparación creada/ejecutada y aplicación.
- Cada invocación exige `commandId`, firma estable de operación/agregado/input y un recibo persistido dentro del agregado tenant-owned. El replay idéntico no repite efecto; la reutilización del ID con otro contenido falla antes de publicar.
- `useIrrigationMirfeCommandStore()` genera identidad por empresa, colapsa duplicados en vuelo y conserva `commandId`/`occurredAt` para recuperar un fallo posterior al commit.
- `manage_irrigation`, `approve_formulas` y `record_irrigation` se validan en el boundary. El cambio de empresa entre intención y commit falla cerrado.
- `executeCoreOperationCommand()` publica `core.operation.requested`, confirma mediante el Store y publica el evento final catalogado con `eventId` determinista, `correlationId` y `causationId`.
- Los eventos nuevos cumplen el contrato real `dominio.entidad.acción`: `mirfe.irrigation.plan.created`, `mirfe.water.analysis.recorded`, `mirfe.nutrient.product.created`, `mirfe.nutrient.objective.recorded`, fórmula y preparación.
- Irrigation Plan, Formulation, Preparations, Irrigation Workflow, Water Analysis, Nutrient Objectives y Nutrient Products dejaron de importar mutadores de dominio o llamar `update()`.
- El commit entra por el Store real: la caché offline guarda `commandReceipts`, `collectionChanges()` encola el registro completo y el transporte remoto conserva el payload y ownership compuesto.

### Pruebas adversariales

- cálculo del plan exclusivamente con camas del tenant activo aun con IDs homónimos;
- historización de agua sin modificar el análisis vigente de otra empresa;
- denegación de permisos antes de evento y commit, incluida aprobación separada;
- replay sin duplicado, colisión de `commandId` y operación/payload cross-tenant;
- preparación y ejecución sin consumir el lote extranjero homónimo;
- un solo Movement, CostEntry y WorkOrder tras retry;
- aplicación replay-safe;
- fallo del evento final, retry con el timestamp original y efecto único;
- cambio de tenant entre intención y commit;
- contrato estático 7/7 que impide reintroducir escrituras directas.

Evidencia: `tests/m3-1-irrigation-mirfe-command.test.mjs` y `tests/m3-1-irrigation-mirfe-command-ui.test.mjs`.

### Quality y reauditoría

- Commit de solución: `89843c9577ffd610abf6459a32a45e7ba2ad0c3f`.
- Quality #1857: **verde**, 867/867 pruebas.
- Cobertura global: 92.70% líneas / 74.99% ramas / 90.49% funciones.
- `irrigationMirfeCommand.js`: 92.71% líneas / 77.93% ramas / 89.29% funciones.
- Static, dependency, environment y session audits, functional evidence, coverage gate, production build y production artifact audit: verdes.
- Reauditoría del HEAD remoto: 9/9 operaciones declaradas; 7/7 páginas sin mutación directa; permisos, tenant guard, recibos, persistencia/sync y causalidad confirmados contra el código real.
- F004 topología, F005 autoridad/versionado matemático, F006 carrera transaccional multi-dispositivo y F011 persistencia de las entidades canónicas permanecen abiertos; no se atribuyen a F003.

## Evidencia de baseline

Las siguientes subsecciones conservan el estado encontrado al abrir M3.1; los cierres verificados anteriores documentan la evolución posterior.

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

- Verified: **3**
- Open: **9**
- P0 abiertos: **3**
- P1 abiertos: **6**
