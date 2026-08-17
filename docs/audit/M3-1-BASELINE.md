# Nexora One — Auditoría Forense v3 · M3.1 Irrigation & MIRFE

Estado: **VERIFIED — M3.1 cerrado 12/12**  
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
| M31-F004 | P0 | **Verified** | Irrigation topology | El plan consume Emitter → Sector → Assignment → POSITION/BED/TRAY con ownership, vigencia y filtros operativos; calcula por emisor físico, evita doble conteo y conserva fallback legacy explícito solo cuando la sede no tiene topología canónica. Quality #1861. |
| M31-F005 | P0 | **Verified** | Formula/versioning | Un solver matricial usa composición normalizada y objetivos netos; aprobación recalcula evidencia tenant-aware en el command boundary y solo acepta validación sin advertencias. Cada cambio crea versión inmutable con lineage y snapshots. Quality #1865. |
| M31-F006 | P0 | **Verified** | Execution/inventory | La ejecución usa un RPC transaccional remoto tenant/site-aware: bloquea y preflighta todas las versiones antes de escribir lote, movimientos, preparación, costo y orden como una unidad idempotente por `commandId`. Quality #1871. |
| M31-F007 | P1 | **Verified** | Tank/planning | Capacidad máxima de 1.000 L, frecuencia entera y cargas por aplicación se derivan con identidad estable; el plan las persiste y cada carga crea una preparación ejecutable tenant-aware con concentración conservada. Quality #1875. |
| M31-F008 | P1 | **Verified** | Water authority | Laboratorio, muestra, método, panel y resultados forman una autoridad tenant-owned e inmutable; admite parciales, versionado append-only, selección vigente determinista y comparación histórica técnicamente compatible. Quality #1879. |
| M31-F009 | P1 | **Verified** | Environment/measurements | `EnvironmentDevice`, `CalibrationRecord`, setpoints versionados, lecturas con fuente/evidencia y alertas first-class reemplazan targets embebidos; tenancy, commands, migración v12 y sync quedan demostrados. Quality #1885. |
| M31-F010 | P1 | **Verified** | Workflow/history | `mirfe-reinforcement-v1` impone transiciones canónicas, historial append-only y correcciones solo tras `Sin respuesta`; cinco commands tenant-aware publican eventos demostrados en Operational Ledger/Timeline. Quality #1891. |
| M31-F011 | P1 | **Verified** | Persistence/sync | Las seis colecciones canónicas de topología, pulso, medición y drenaje forman parte del schema v14, ownership, caché, bootstrap y sync remoto tenant-aware; IDs repetidos y tombstones quedan aislados. Quality #1895. |
| M31-F012 | P1 | **Verified** | Passport/Graph/tests | Passport/Knowledge Graph explican Assignment → Sector/Emitter → Pulse → Measurement/Drainage y Application → Preparation → Formula → Inventory Lot con tenancy y causalidad temporal fail-closed. Quality #1917. |

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
- descuento exclusivo del lote activo y etiquetado de Movement/CostEntry/WorkOrder;
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

## M31-F004 — cierre verificado

### Solución

- `src/domain/irrigationTopology.js` proyecta la topología operativa Emitter → Sector → Assignment → POSITION/BED/TRAY dentro de la organización y sede activas.
- `irrigationHydraulicsForPlan()` filtra por casa, sector, genética y vigencia; resuelve RING, STAKE, SHARED, MULTI y MANUAL desde emisores físicos, sin multiplicar accidentalmente el caudal por plantas o estacas.
- La validación exige capacidad coherente de plantas, salidas y estacas. Referencias cross-tenant, targets duplicados y solapamientos BED/POSITION fallan cerrado antes del cálculo.
- Una topología canónica configurada pero expirada o no coincidente no cae silenciosamente al cálculo agregado. `LEGACY_BEDS` se conserva solo para sedes sin Assignments canónicos.
- El plan persiste `calculationMode` y un `topologySnapshot` con Assignments, sectores, emitters y desglose por asignación/sector; el evento publica sus conteos sin incluir homónimos extranjeros.
- `IrrigationPlanPage` permite acotar por sector y muestra la fuente del cálculo y el modo de control manual/automático.
- Este cierre consume colecciones canónicas presentes en estado, pero no las incorpora aún al schema/bootstrap/sync; M31-F011 permanece abierto de forma explícita.

### Pruebas adversariales

- `tests/m3-1-irrigation-topology.test.mjs`: nueve casos para IDs repetidos entre tenants, cinco tipologías, filtro por sector, fallback legacy, referencia extranjera, capacidad, doble conteo, vigencia y bandejas/genética.
- `tests/m3-1-irrigation-topology-command.test.mjs`: snapshot y evento tenant-aware, rechazo previo a publicar ante emisor extranjero y contrato de UI para sector/fuente canónica.
- La suite histórica permanece compatible y el cálculo legacy sigue disponible únicamente bajo su precondición declarada.

### Quality y reauditoría

- Commit de solución: `cf58fd056212045a80b1bd7baab39cdf0f6b45bd`.
- Quality #1861: **verde**, 879/879 pruebas.
- Cobertura global: 92.83% líneas / 74.86% ramas / 90.67% funciones.
- `irrigationTopology.js`: 99.29% líneas / 64.89% ramas / 100% funciones.
- Static, dependency, environment y session audits, functional evidence, coverage gate, production build y production artifact audit: verdes.
- Reauditoría del HEAD remoto: el command usa `irrigationHydraulicsForPlan()`, persiste el snapshot y publica modo/conteos; la página no reintroduce `update()`; las referencias y el cálculo fallan cerrado por tenant.
- F005 autoridad matemática/versionado, F006 carrera transaccional multi-dispositivo y F011 persistencia/sync canónicos continúan abiertos y no se atribuyen a F004.

## M31-F005 — cierre verificado

### Solución

- `solveFertigationFormula()` reemplaza el reparto por suma global con mínimos cuadrados no negativos sobre la matriz producto–nutriente; usa gramos, litros y ppm de forma explícita.
- La composición acepta fichas legacy y `FertigationProduct.analysis`, convierte P₂O₅/K₂O/CaO/MgO/SO₃ a elemento, aplica pureza y descuenta del objetivo N-NO₃, N-NH₄ y demás aportes del agua.
- El solver respeta el límite de solubilidad y penaliza nutrientes sin objetivo para preferir alternativas limpias. `validateFormula()` rechaza desviación, aporte no solicitado, referencia ausente/ambigua, cantidad inválida, duplicado, tanque incoherente y calcio junto con fosfato/sulfato.
- El command boundary ignora la `validation` declarada por el cliente: resuelve objetivo, agua y productos dentro del tenant activo, recalcula evidencia y falla antes de publicar si una aprobación conserva advertencias.
- Borradores advertidos siguen permitidos y quedan explícitamente no aprobables; `createFertigationFormula()` también impide construir directamente un estado aprobado sin validación canónica válida.
- Fórmulas nuevas se agregan sin mutar las anteriores: `formulaKey`, `version` y `supersedesFormulaId` forman el lineage. Se fijan snapshots de objetivo, agua, productos y composición.
- Preparación y aplicación conservan `formulaKey`/`formulaVersion`; el adaptador legacy mantiene `volumeL` mientras la autoridad canónica usa `volumeLiters`.
- No se añadió schema/bootstrap/sync para nuevas colecciones: M31-F011 permanece abierto; la carrera de inventario multi-dispositivo sigue aislada en M31-F006.

### Pruebas adversariales

- `tests/m3-1-formulation-authority.test.mjs`: ocho casos para nitrógeno del agua, óxidos/pureza, producto canónico, solver por composición, aporte sin objetivo, solubilidad, compatibilidad, referencias/duplicados/cantidades y guard de aprobación.
- `tests/m3-1-formulation-command.test.mjs`: seis casos para validación server-side, payload cliente falsificado, IDs repetidos cross-tenant, historial inmutable, siguiente versión, snapshot de preparación, referencia extranjera, borrador advertido y contrato de UI.
- `tests/m3-1-irrigation-mirfe-command.test.mjs` se ajustó únicamente para suministrar la evidencia ahora obligatoria a la prueba histórica de aprobación.
- Pruebas dirigidas locales: 38/38, incluidas regresiones F001/F003 e inventario.

### Quality y reauditoría

- Commit de solución: `32fc999dfc5edc3e767db9e9b3f3609b27b791f8`.
- Quality #1865: **verde**, 893/893 pruebas.
- Cobertura global: 92.89% líneas / 75.14% ramas / 90.66% funciones.
- `formulation.js`: 100% líneas / 79.28% ramas / 100% funciones.
- `irrigationMirfe.js`: 100% líneas / 74.58% ramas / 100% funciones.
- `irrigationMirfeCommand.js`: 90.25% líneas / 82.42% ramas / 84.29% funciones.
- Static, dependency, environment y session audits, functional evidence, coverage gate, production build y production artifact audit: verdes.
- Reauditoría del HEAD remoto: 17/17 controles estáticos de autoridad, eliminación de la heurística, server revalidation, tenancy, lineage, snapshots, UI y evidencia adversarial pasaron.
- M31-F006 continúa abierto como único P0: dos command IDs concurrentes todavía requieren precondición remota/transacción de inventario.

## M31-F006 — cierre verificado

### Solución

- La ejecución de una preparación usa `commit_mirfe_inventory_execution`, un RPC `SECURITY DEFINER` que exige sesión, membresía activa, `manage_irrigation`, ausencia de deny y alcance de sede.
- `mirfe_inventory_executions` conserva por empresa `commandId`, firma, preparación, sede y resultado canónico. Un replay idéntico devuelve el resultado persistido; una colisión de contenido falla cerrado y la autorización se revalida contra la sede original.
- Un advisory lock serializa el mismo comando. Después, el RPC ordena y bloquea todos los `erp_records`, verifica todas las `baseVersion` y solo entonces escribe; cualquier conflicto revierte lote, movimientos, preparación, costo, orden y recibo remoto como una sola transacción.
- El servidor rechaza colecciones, operaciones, IDs, ownership o sedes fuera del boundary; exige consecuencias nuevas, preparación remota pendiente y saldo inicial igual al lote remoto bloqueado. También valida continuidad de movimientos, saldo final, producto, sede y referencias MIRFE.
- El command publica primero `core.operation.requested`, ejecuta la precondición remota y solo después confirma localmente y publica `mirfe.preparation.completed`. Un fallo remoto no hace commit local ni genera falso completion.
- La confirmación debe contener exactamente el conjunto canónico esperado, sin identidades duplicadas o extranjeras. Se hidrata con versiones remotas y `sync:false`, evitando reencolar por el transporte genérico registros ya aplicados atómicamente.
- IDs de movimiento, costo y orden derivan de `commandId`. Una respuesta perdida se recupera mediante el mismo ID sin repetir efectos; un cambio de tenant durante el RPC no hidrata el contexto equivocado ni publica completion.
- Instalaciones sin Supabase conservan el comportamiento local histórico; la ruta remota fail-closed solo se activa cuando Supabase está configurado.

### Pruebas adversariales

- `tests/m3-1-inventory-concurrency.test.mjs`: siete casos para unidad remota completa, dos dispositivos desde la misma versión, perdedor sin efectos, cambio de tenant, replay tras respuesta perdida, confirmación parcial/ajena, contrato SQL y activación productiva.
- `tests/m1-1-core-operation-command.test.mjs` demuestra el orden intención → precondición → commit → completion y que un fallo de precondición no muta ni completa.
- `tests/sync-engine.test.mjs` fija la captura aditiva de `previousPayload`, origen de la versión base remota, sin cambiar el contrato histórico de la cola.
- Pruebas dirigidas locales: 66/66, incluidas regresiones de command boundary, formulación, topología, inventario y sync.

### Quality y reauditoría

- Commit de solución: `b20228c179b564aef92feed5916aac64b9474621`.
- Quality #1869: rojo útil, 901/902; la única incompatibilidad fue una aserción estática histórica que exigía la forma literal del commit local.
- Commit de compatibilidad sin alterar la ruta transaccional: `c46828c386792dc672bc3fadcaef276b029ab4c2`.
- Quality #1871: **verde**, 902/902 pruebas.
- Cobertura global: 92.99% líneas / 74.96% ramas / 90.83% funciones.
- `mirfeInventoryTransaction.js`: 100% líneas / 52.94% ramas / 100% funciones; `coreOperationCommand.js`: 100% / 80% / 100%; `irrigationMirfeCommand.js`: 90.57% / 82.81% / 84.72%.
- Static, dependency, environment y session audits, functional evidence, coverage gate, production build y production artifact audit: verdes.
- Reauditoría del HEAD remoto: 10/10 blobs leídos desde GitHub y 13/13 controles de RPC, locks/preflight, saldo remoto, tenant/sede, idempotencia, orden causal, sync y compatibilidad histórica pasaron.
- Con F006 no quedan P0 abiertos en M3.1. F007–F012 permanecen P1 y no se atribuyen a este cierre.

## M31-F007 — cierre verificado

### Solución

- `irrigationTankPlanning.js` establece 1.000 L como máximo operativo, exige una frecuencia diaria entera positiva y limita tanto aplicaciones como preparaciones para evitar planes no ejecutables.
- Cada aplicación se divide de forma independiente: una carga nunca mezcla volumen de aplicaciones distintas. El plan verifica conservación del volumen diario y expone frecuencia, preparaciones por aplicación, total diario, última carga y un `loadSchedule` inmutable.
- Las identidades derivan de plan → aplicación → carga. La topología canónica y el fallback legacy usan el mismo planificador, mientras `hydraulics()` conserva los alias históricos `daily`, `loads` y `last`.
- El command persiste cada carga con empresa, sede, casa, sector, genética, etapa y fecha. La resolución exige una única carga dentro del tenant activo y la reserva `PLANNED → PREPARATION_CREATED` ocurre en el mismo commit que crea la preparación.
- Una preparación planificada exige `irrigationPlanId` y `loadId`; su ID deriva de la carga e ignora un `entityId` arbitrario del cliente. Sede, etapa y genética de plan/fórmula deben coincidir antes de publicar eventos o mutar estado.
- El volumen real de la carga no puede superar 1.000 L y escala proporcionalmente los gramos de la fórmula, conservando concentración. Varias cargas de una misma fórmula generan preparaciones e ítems distintos sin relajar el bloqueo histórico para preparaciones libres.
- `IrrigationPlanPage` limita la capacidad, exige aplicaciones enteras y muestra frecuencia/cargas. `PreparationsPage` materializa cargas pendientes solo con fórmulas aprobadas compatibles y conserva por separado el flujo libre histórico.
- F011 sigue abierto: este cierre persiste el calendario dentro del plan legacy ya sincronizado, pero no atribuye schema/bootstrap/sync a las entidades canónicas pendientes.

### Pruebas adversariales

- `tests/m3-1-tank-planning.test.mjs`: límites, aplicaciones fraccionarias, división por aplicación sin agregación cruzada, conservación de volumen y escalado de una fórmula de 1.000 L a una carga parcial.
- `tests/m3-1-tank-planning-command.test.mjs`: IDs repetidos entre empresas, contexto persistido, payload cliente hostil, fórmula homónima extranjera, dos cargas de una misma fórmula, doble reserva, incompatibilidad de etapa/genética, fallo antes de eventos y contrato de UI.
- Pruebas dirigidas locales: 78/78, incluidas regresiones F001–F006, inventario y sync.

### Quality y reauditoría

- Commit de solución: `7e254b41bd2ee9f51aa73b35aba58332e36c291f`.
- Quality #1875: **verde**, 911/911 pruebas.
- Cobertura global: 93.07% líneas / 75.15% ramas / 90.93% funciones.
- `irrigationTankPlanning.js`: 100% líneas / 83.87% ramas / 100% funciones; `irrigationExecution.js`: 100% / 52.21% / 92.59%; `irrigationMirfeCommand.js`: 91.67% / 81.70% / 86.42%.
- Static, dependency, environment y session audits, functional evidence, coverage gate, production build y production artifact audit: verdes.
- Reauditoría del HEAD remoto: los 10/10 blobs coinciden con el commit publicado y pasaron 21/21 controles de límites, frecuencia, identidad, conservación, tenancy, compatibilidad, reserva atómica, eventos, UI y evidencia adversarial.
- F008–F012 permanecen P1 abiertos y no se atribuyen a este cierre.

## M31-F008 — cierre verificado

### Solución

- `waterAnalysis.js` define un panel canónico de 20 analitos con unidad y base, y estados `Pendiente`, `Parcial` y `Vigente`. Cada resultado conserva valor, método, unidad y base en vez de depender de campos numéricos ambiguos.
- Un análisis exige `laboratoryId`, nombre de laboratorio, `sampleId`, punto/tipo/fecha de muestreo, método, panel esperado y sede/empresa. Fecha civil, orden muestra → informe, pH, finitud, duplicados y catálogos fallan cerrado.
- Los parciales conservan ausencias explícitas; un registro no puede declararse `Vigente` hasta completar su panel. Los aliases planos se mantienen solo como proyección compatible para formulación y datos históricos.
- Cada reanálisis crea otro ID con `analysisKey`, versión derivada y `supersedesWaterAnalysisId`. Empresa, sede, laboratorio, muestra y panel del lineage permanecen estables; el registro anterior no cambia de estado ni contenido.
- `sampleId` no puede referir contradictoriamente otro punto, tipo, instante o sede dentro del tenant; distintos laboratorios sí pueden analizar la misma muestra.
- La selección vigente filtra por empresa/sede, valida identidades y versiones únicas, exige los analitos requeridos por el consumidor y ordena por tiempo/versión/ID. El estado `Histórico` es una proyección efectiva, nunca una reescritura.
- `compareWaterAnalyses()` exige igual empresa, sede, punto y tipo de muestra, y solo calcula deltas cuando método, unidad y base coinciden; resultados incompatibles quedan excluidos de forma explícita.
- Planificación, `waterForSite`, Formulation UI y aprobación server-side consumen el mismo selector. La fórmula solo admite un análisis vigente con N-NO₃, N-NH₄, P, K, Ca, Mg y S presentes.
- El evento conserva lineage, laboratorio, muestra y completitud. La nueva evidencia sigue dentro de `waterAnalyses`, colección legacy ya persistida/sincronizada con ownership compuesto; F011 no se atribuye a este cierre.
- Water Analysis UI materializa parciales, nuevas versiones, estado efectivo y comparación histórica sin mutación directa del Store.

### Pruebas adversariales

- `tests/m3-1-water-authority.test.mjs`: 8 casos para catálogo, inmutabilidad, adaptadores legacy, panel parcial/completo, fechas, lineage, payload cliente de versión, tenant, selección determinista, duplicados, comparación compatible/incompatible y estabilidad de muestra.
- `tests/m3-1-water-authority-command.test.mjs`: 6 casos para IDs repetidos entre empresas, append-only, parcial → versión vigente, referencia/sede/identidad inválida antes de eventos, integración con formulación, contrato UI y round-trip por persistencia/sync sin tocar el homónimo extranjero.
- Los contratos históricos F003 y F005 se ajustaron únicamente donde fijaban la reescritura de estado o representaban ceros implícitos; ahora demuestran append-only y analitos explícitos.
- Pruebas locales disponibles: 92/92, incluidas regresiones F001–F007, inventario y sync.

### Quality y reauditoría

- Commit de solución: `e04eaef867896609d9941beb29b32fd38722a753`.
- Quality #1879: **verde**, 925/925 pruebas.
- Cobertura global: 93.20% líneas / 75.41% ramas / 91.03% funciones.
- `waterAnalysis.js`: 100% líneas / 80.32% ramas / 100% funciones; `irrigation.js`: 100% / 44.44% / 75%; `irrigationMirfeCommand.js`: 90.44% / 84.21% / 84.34%.
- Static, dependency, environment y session audits, functional evidence, coverage gate, production build y production artifact audit: verdes.
- Reauditoría del HEAD remoto: los 9/9 blobs coinciden con el commit publicado y pasaron 28/28 controles de catálogo, identidad, parcial, versión, tenancy, compatibilidad, command boundary, evento, UI, formulación, persistencia y sync.
- F010–F012 permanecen P1 abiertos y no se atribuyen a este cierre.

## M31-F009 — cierre verificado

### Solución

- `src/domain/environment.js` establece cinco autoridades tenant-owned: `environmentDevices`, `environmentCalibrations`, `environmentSetpoints`, `environmentalReadings` y `environmentAlerts`.
- Dispositivos `SENSOR` y `CONTROLLER` declaran zona, variables e identidad de integración. Una lectura de dispositivo exige tipo coincidente y calibración `PASS`, vigente en el instante observado y compatible con todas sus variables.
- Las seis fuentes transversales (`SENSOR`, `CONTROLLER`, `MANUAL`, `SAMPLE`, `IMPORTED`, `CALCULATED`) conservan evidencia específica; manual fija actor, muestra/importación fijan su ID y cálculo fija método y lecturas causales no futuras.
- Los targets viven exclusivamente en setpoints inmutables y append-only mediante `setpointKey`, `version` y `supersedesSetpointId`. La selección vigente es determinista por empresa/sede/zona/tiempo y falla ante identidad, versión o lineage ambiguos.
- Cada lectura conserva únicamente referencias exactas a dispositivo, calibración y setpoint. Las desviaciones generan `EnvironmentalAlert` first-class con identidad determinista; no se recalculan desde targets copiados dentro de la lectura.
- `scopeEnvironmentState()` y `mergeEnvironmentState()` aplican identidad compuesta y preservan homónimos extranjeros. La resolución recorre sede/área/zona y excluye evidencia sin ownership inequívoco.
- La migración v12 mueve targets legacy a setpoints, convierte su origen en `IMPORTED`, genera alertas históricas cuando la evidencia es válida y deja ownership o evidencia corrupta en cuarentena, sin secuestrar datos ni bloquear la carga.
- Cuatro operaciones pasan por command boundary con permiso `manage_settings`, firma/recibo idempotente, retry estable y chequeo del tenant al commit: registrar dispositivo, calibración, setpoint y lectura.
- Eventos: `core.operation.requested` seguido de `environment.device.registered`, `environment.calibration.recorded`, `environment.setpoint.created` o `environment.reading.recorded`, con correlación/causalidad deterministas.
- La UI delega a `EnvironmentMeasurementsPanel`, conserva el control fecha/hora Safari-safe y expone fuentes, dispositivos, calibraciones, historial de setpoints, lecturas trazables y alertas canónicas.
- Las cinco colecciones están inicializadas por schema, participan del bootstrap genérico y de `SYNCABLE_COLLECTIONS`; payload, referencias, recibos y homónimos extranjeros sobreviven el round-trip. F011 permanece abierto para las entidades canónicas de F001 aún no integradas.

### Pruebas adversariales

- `tests/m3-1-environment-authority.test.mjs`: 8 casos para inmutabilidad, límites físicos/unidades, SENSOR/CONTROLLER, calibración vigente/FAIL, seis fuentes, setpoints/versiones, IDs repetidos, scope/merge, migración idempotente, ownership ambiguo y cuarentena de evidencia corrupta.
- `tests/m3-1-environment-command.test.mjs`: 9 casos para cuatro operaciones, eventos/recibos, replay/colisión, permisos, referencias extranjeras, identidad duplicada, cambio de empresa entre intención y commit, causalidad calculada, persistencia/sync y contrato UI.
- `tests/stateMigration.test.mjs` demuestra schema v12 y separación de targets; `tests/ux-f001-r1-date-time-controls.test.mjs` sigue la delegación y conserva la protección Safari histórica.
- Pruebas locales disponibles: 119/119, incluidas regresiones F001–F008, inventario, migración y sync.

### Quality y reauditoría

- Commit de solución: `700ee7a53fa2fb77daea691882996c3553a6a22e`; compatibilidad histórica focalizada: `27984bca7bd4d83ec5f2dc3ca16a3d238b0bda3e`.
- Quality #1883 reprodujo un único contrato histórico que aún buscaba `DateTimeFields` en la página padre; 941/942 pruebas pasaron. El test se actualizó para verificar la delegación real, sin import muerto ni cambio productivo.
- Quality #1885: **verde**, 942/942 pruebas.
- Cobertura global: 93.45% líneas / 75.46% ramas / 91.04% funciones.
- `environment.js`: 95.79% líneas / 76.37% ramas / 93.44% funciones; `environmentCommand.js`: 98.61% / 75.86% / 88.64%.
- Static, dependency, environment y session audits, functional evidence, coverage gate, production build y production artifact audit: verdes.
- Reauditoría del HEAD remoto: 12/12 blobs coinciden byte a byte con la publicación y 58/58 controles semánticos pasaron para autoridad, fuentes, calibración, setpoints, alerts, migración, tenancy, commands, eventos, UI, persistencia, sync y compatibilidad histórica.
- F010–F012 permanecen P1 abiertos; el próximo cierre es workflow/history y no se atribuye a F009.

## M31-F010 — cierre verificado

### Solución

- `mirfe-reinforcement-v1` reutiliza `workflowCore` y materializa nueve estados canónicos: Borrador, Pendiente aprobación, Aprobado, Programado, Aplicado, En seguimiento, Efectivo, Sin respuesta y Cancelado.
- El lifecycle impide saltos y mutaciones terminales. Una verificación exige resultado agronómico; una cancelación exige motivo; solo `Sin respuesta` admite `CORRECT`, que crea una corrección append-only y reabre la aprobación sin reescribir la evidencia anterior.
- Programa, monitoreo, refuerzo, corrección e historia llevan `organizationId`. El monitoreo recalcula VPD y ΔEC dentro de dominio; el refuerzo conserva snapshots de programa, monitoreo y producto, además de versión e historial verificable.
- Las cinco colecciones pasan a ser command-owned y sus referencias sede/nave/cama/genética/producto/programa/monitoreo/refuerzo se resuelven por tenant e identidad inequívoca. IDs homónimos entre organizaciones permanecen aislados.
- El boundary existente incorpora `CREATE_MIRFE_PROGRAM`, `RECORD_MIRFE_MONITORING`, `CREATE_MIRFE_REINFORCEMENT`, `TRANSITION_MIRFE_REINFORCEMENT` y `RECORD_MIRFE_CORRECTION`, todos con `manage_mirfe`, firma/recibo idempotente, causalidad determinista y control optimista de versión al commit.
- Los eventos `mirfe.program.created`, `mirfe.monitoring.recorded`, `mirfe.reinforcement.created`, `mirfe.reinforcement.transitioned` y `mirfe.correction.recorded` se etiquetan como MIRFE y recorren `core.operation.requested → commit → completion → Operational Ledger → Timeline`.
- Schema v13 migra estados legacy mediante IDs deterministas. Ownership o estados ambiguos/corruptos quedan en cuarentena fail-closed.
- Programas, monitoreo, refuerzos, historial y dashboard usan la vista tenant-scoped; las cuatro superficies escritoras ya no importan `useStore` ni llaman `update()`, y la UI solo ofrece transiciones permitidas.

### Pruebas adversariales

- Secuencia completa, saltos inválidos, guards de resultado/motivo, terminales, corrección y detección de identidad/versión/tiempo adulterados.
- IDs repetidos cross-tenant, referencias extranjeras, permiso ausente, replay idéntico, colisión de `commandId` y carrera de versión entre intent y commit.
- Recálculo server-side de derivados, snapshots históricos, migración determinista/cuarentena y proyección de un completion real a Ledger/Timeline con organización, agregado, correlación y causalidad.
- Contratos UI prueban ausencia de mutación directa, eliminación del selector arbitrario de estado y exposición de historia agronómica append-only.

### Quality y reauditoría

- Commit de solución: `b6a9f85f3930f39a887130ffb6aa3abcbd2417bb`; compatibilidad histórica focalizada: `87521f31fc710c094f734e4867aadb3cd2c2ec5c`.
- Quality #1889 reprodujo un único contrato histórico que aún buscaba `phaseOf` y la mutación directa eliminada; 955/956 pruebas pasaron. El test se alineó con `mirfeWorkflowPhase`, las transiciones canónicas y el command boundary, sin introducir código muerto.
- Quality #1891: **verde**, 956/956 pruebas.
- Cobertura global: 93.65% líneas / 75.13% ramas / 91.14% funciones.
- `mirfeWorkflow.js`: 97.52% líneas / 65.31% ramas / 96.30% funciones; `irrigationMirfeCommand.js`: 93.05% / 78.90% / 86.11%.
- Static, dependency, environment y session audits, functional evidence, coverage gate, production build y production artifact audit: verdes.
- Reauditoría del HEAD remoto: 16/16 blobs coinciden byte a byte y 76/76 controles semánticos pasaron para workflow, guards, historial, corrección, migración, tenancy, commands, replay, concurrencia, eventos, Ledger/Timeline, UI y compatibilidad histórica.
- F011 y F012 permanecen abiertos y separados: este cierre no incorpora aún las entidades F001 a schema/bootstrap/sync ni amplía Passport/Knowledge Graph.

## M31-F011 — cierre verificado

### Solución

- `CANONICAL_IRRIGATION_COLLECTIONS` declara una sola vez `irrigationEmitters`, `irrigationSectors`, `irrigationAssignments`, `irrigationPulses`, `irrigationMeasurements` y `drainageMeasurements`; ownership, schema y sync consumen el mismo registro para impedir drift entre capas.
- Las seis colecciones pasan por `IRRIGATION_MIRFE_OWNERSHIP_COLLECTIONS`. El backfill v14 atribuye registros legacy únicamente cuando sede o referencias causales resuelven una sola empresa; una identidad multiempresa ambigua permanece sin atribuir y fuera de las vistas operativas.
- `initialState` y `migrateState()` inicializan las seis colecciones. `safeStorage` normaliza tanto carga como guardado y la caché segmentada conserva objetos anidados, fuentes, unidades y evidencia dentro de la partición de la empresa activa.
- `SYNCABLE_COLLECTIONS` incorpora el registro compartido. `collectionChanges()` usa organización + ID, `enqueueChanges()` rechaza ownership extranjero y el pull rechaza tanto filas como payloads de otra empresa antes de hidratar.
- Upsert y tombstone remotos afectan solo la identidad compuesta del tenant activo; un homónimo extranjero permanece intacto.
- El bootstrap autoritativo descubre arrays operativos de forma genérica, valida la organización de cada fila, reemplaza solo la partición activa y superpone deltas offline concurrentes por organización + ID.
- El transporte y PostgreSQL ya eran genéricos y no requirieron lógica duplicada: el pull filtra `organization_id`, `erp_records` usa PK `(organization_id, collection, record_id)` y los RPC de mutación/bootstrap revalidan autenticación y membresía.
- No se modificaron commands, eventos, UI, workflow ni Passport/Graph. F012 conserva íntegramente el alcance de proyección end-to-end.

### Pruebas adversariales

`tests/m3-1-irrigation-persistence-sync.test.mjs` demuestra:

- creación del schema v14 y presencia en estado inicial, bootstrap y allowlist de sync;
- backfill causal de las seis colecciones y exclusión fail-closed de ownership ambiguo;
- round-trip de caché con evidencia anidada e IDs idénticos en `org-a`/`org-b`;
- cola de seis mutaciones con payload, ownership y versión previa del tenant activo;
- upsert y borrado remoto sin alterar el homónimo extranjero;
- rechazo de fila extranjera y de payload extranjero dentro de una fila aparentemente local;
- hidratación autoritativa de las seis colecciones, conservación de la partición ajena y rechazo de snapshots contaminados;
- prevalencia de deltas offline concurrentes únicamente sobre la identidad compuesta correspondiente.

La regresión local disponible quedó 152/152. Quality ejecutó la suite completa con 964/964 pruebas.

### Quality y reauditoría

- Commit de solución: `8031026835f8ed8dffea1d8f0f81d175b7b24a15`.
- Quality #1895: **verde**, 964/964 pruebas.
- Cobertura global: 93.52% líneas / 75.23% ramas / 90.79% funciones.
- `irrigationMirfeTenancy.js`: 98.88% líneas / 86.00% ramas / 100% funciones; `stateMigration.js`: 95.65% / 70.73% / 78.26%; `syncEngine.js`: 91.26% / 82.28% / 95.24%.
- Static, dependency, environment y session audits, functional evidence, coverage gate, production build y production artifact audit: verdes.
- Reauditoría del HEAD remoto: 14/14 blobs inspeccionados y 50/50 controles semánticos pasaron para registro de colecciones, ownership, schema, caché, bootstrap, overlay concurrente, cola, pull, tombstones, transporte y garantías SQL.
- F012 queda como único hallazgo abierto de M3.1: Passport/Knowledge Graph end-to-end.

## M31-F012 — cierre verificado

### Solución

- `src/core/passport/irrigationMirfePassportProjection.js` proyecta por planta, empresa y ventana causal la cadena `Assignment → Sector/Emitter → Pulse → Measurement/Drainage` y `Application → Preparation → Formula → Inventory Lot`.
- `src/core/passport/passportProjectionEnrichment.js` registra el enriquecimiento exclusivamente para `cultivation.plant.projection`; si una planta no tiene evidencia Irrigation/MIRFE, conserva el Passport anterior sin fabricar indicadores cero.
- `passportProjectionPlugin.js` integra el enriquecimiento en el pipeline universal sin mover autoridad de dominio a React ni crear una vía paralela de Graph.
- Cada relación fija `targetOrganizationId`; la proyección al Knowledge Graph conserva ese tenant y no crea nodos extranjeros.
- IDs homónimos entre empresas se resuelven por ownership compuesto. Referencias extranjeras, ownership ambiguo y duplicados dentro del mismo tenant fallan cerrado en lugar de deduplicarse u ocultarse silenciosamente.
- Pulsos, mediciones, drenajes y aplicaciones respetan tanto la vigencia de `IrrigationAssignment` como `createdAt` de la planta. Evidencia anterior a la planta o posterior a la ventana causal queda excluida.
- Una aplicación resuelve `Preparation → Formula` y los lotes de inventario consumidos dentro del mismo tenant, conservando cantidad, unidad y costo por uso.
- Passport incorpora relaciones, indicadores y Timeline para riego, fertirriego, EC/pH y drenaje; el Graph hereda la misma evidencia canónica.

### Pruebas adversariales

- `tests/m3-1-irrigation-mirfe-passport-graph.test.mjs` cubre IDs idénticos `org-a`/`org-b`, pulso fuera de vigencia, EC/pH, drenaje, fórmula versionada, lote y costo consumido, las diez relaciones canónicas del Graph, sector extranjero, lote extranjero y compatibilidad de una planta sin evidencia.
- `tests/m3-1-irrigation-mirfe-passport-reaudit.test.mjs` fuerza identidad duplicada dentro del tenant y evidencia temporal anterior a la planta o fuera de la vigencia del Assignment.
- Quality #1907 fue rojo útil: 968/969; reprodujo un `IrrigationAssignment` del tenant activo con referencia estructural extranjera que el resolver ocultaba como ausencia. No hubo fuga cross-tenant, pero sí fail-silent.
- La corrección convirtió ese caso en fallo cerrado explícito. Quality #1911 quedó verde con 969/969.
- La reauditoría endureció duplicados same-tenant y causalidad temporal. Quality #1917 quedó **verde con 971/971 pruebas**.

### Quality y reauditoría

- Commits principales de F012: `bba67495759d5112ec86b68d955dfee0f4b72518`, `04f11a1a3760f64d723b304eac95010ccd0b7b91`, `23498504aaeb2ad88d32cb2236b6477bd1ef2bb8`, `04e3032cdbd47965392f003d58918d41db9ca42e`.
- Corrección fail-closed: `7b3dd58d017004e10e721b0b8c43a40e305b7a40`.
- Reauditoría de identidad/tiempo: `be95656645eae6ae635394b8e5c2c78ce7fc1f73`, `87b823a252478ddfe8f1d138fef7ca1cf007dcd8`, `1b56f755f8c2bdd77063ba54a2090195a263cf43`.
- Quality #1917: **verde**, 971/971 pruebas en 202 archivos; static audit, dependency audit, environment contract, authentication/session audit, coverage gate, production build y production artifact audit verdes.
- Reauditoría independiente: no se encontró fuga cross-tenant ni pérdida de causalidad en la frontera proyectada; duplicados de identidad y referencias activas corruptas son fail-closed.
- `cultivation.materialplant` (abuelas/madres) conserva su Passport de material vegetal; F012 proyecta la evidencia operativa sobre `cultivation.plant`, que es la entidad individual productiva conectada a Position/Bed y al Knowledge Graph operativo.
- Con F012 no quedan hallazgos P0/P1 abiertos dentro de M3.1.

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

- Verified: **12**
- Open: **0**
- P0 abiertos: **0**
- P1 abiertos: **0**
