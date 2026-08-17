# Nexora One — Auditoría Forense v3 · M3.2 MIPE

Estado: **AUDIT IN PROGRESS — 8/12 Verified**  
Base certificada: M3.1 Irrigation & MIRFE, head `6943ad022ba7c88fc7eb1b5111552f4b06b22992`, Quality #1919 verde.  
Bloque: M3 — Agronomy Operational (`MIRFE + MIPE + Inventory integration`).  
Normativa: `docs/NEXORA_DOMAIN_MODEL_V1.md` + `docs/NEXORA_PRODUCT_DOCTRINE.md`.  
Método: Audit → Fix → Test → Quality Gate → Re-Audit → Close.

## Alcance M3.2

MIPE se audita como autoridad operativa completa: incidencia, hallazgo, severidad, seguimiento, intervención, tratamiento, producto, dosis, lote, consumo/costo, restricciones de reentrada/carencia, permisos, eventos, tenancy, persistencia/sync, dashboard/croquis, Passport/Knowledge Graph y pruebas adversariales.

## Estado de hallazgos

| ID | Sev. | Estado | Área | Resultado / riesgo pendiente |
|---|---:|---|---|---|
| M32-F001 | P0 | **Verified** | Domain authority | Incident/Finding/Treatment/Intervention tenant-owned e inmutables. Quality #1926. |
| M32-F002 | P0 | **Verified** | Tenancy | Ownership causal, IDs homónimos aislados, scope/merge/backfill fail-closed y UI tenant-scoped. Quality #1945. |
| M32-F003 | P0 | **Verified** | Commands/permissions/events | Operaciones explícitas, permisos, replay, tenant guard y requested→commit→completion; superficies MIPE sin mutación directa. Quality #1983; cierre documental #1986. |
| M32-F004 | P0 | **Verified** | Treatment/inventory transaction | Ejecución remota atómica de lote+movimiento+Treatment+Finding+costo, con locks/version preflight/idempotencia. Quality #2000; cierre documental #2002. |
| M32-F005 | P1 | **Verified** | Workflow/audit history | Workflow canónico e historial append-only; correcciones con before/after, hard-delete prohibido, UI sin reescritura y replay post-workflow idempotente. Quality #2034. |
| M32-F006 | P1 | **Verified** | Follow-up/interventions | Intervention canónica tenant-aware, snapshots causales, tareas de revisión correctas y reasignación append-only sin bypass legacy. Quality #2076; documental #2078. |
| M32-F007 | P1 | **Verified** | Incident/product authority | Incident no destructivo y vigente; Product técnico ejecutable congelado en Treatment; costo/reentrada/carencia no dependen del catálogo mutable. Quality #2118; documental #2120. |
| M32-F008 | P1 | **Verified** | Persistence/sync | Migración MIPE dedicada, caché/bootstrap/sync/tombstones y receipts tenant-aware con identidad estable. Quality #2135. |
| M32-F009 | P1 | **Open** | Operational restrictions | Falta consolidar reentrada, carencia y bloqueos/liberaciones como restricciones proyectables. |
| M32-F010 | P1 | **Open** | Dashboard/croquis/context | Falta cerrar contexto jerárquico persistente Empresa→Sede→Nave→Cama→Planta y croquis. |
| M32-F011 | P1 | **Open** | Passport/Knowledge Graph | Falta traza canónica Finding→Incident→Intervention/Treatment→Product/Lot→Restriction/Resolution. |
| M32-F012 | P1 | **Open** | Adversarial verification | Falta reauditoría transversal final de workflow, sync, Graph y ausencia de fuga/regresión. |

## M32-F001 — cierre verificado

### Solución

- `src/domain/mipeAuthority.js` define `Incident`, `Finding`, `Treatment` e `Intervention` con ownership explícito, identidad estable y deep immutability.
- Finding compone Target + Incident dentro de la misma organización/sede, valida severidad, fechas y evidencia.
- Treatment valida Finding/Product, dosis/unidad/volumen y congela snapshot de producto, reentrada, carencia y costo.
- Intervention hereda tenant/sede del Finding y exige causalidad correcta con Treatment cuando aplica.

### Evidencia

- `tests/m3-2-mipe-domain-authority.test.mjs`: IDs repetidos cross-tenant, referencias extranjeras, dosis/unidades, snapshot e intervención causal.
- Quality #1926: **981/981**, todos los gates verdes.

## M32-F002 — cierre verificado

### Solución

- `src/domain/mipeTenancy.js` resuelve ownership por sede/Position/material vegetal/Finding/Product/Lot/Treatment, no por ID global.
- `findMipeRecord()` falla cerrado ante extranjero, ambigüedad o duplicado same-tenant.
- `scopeMipeState()` y `mergeMipeState()` aíslan la partición activa y preservan homónimos extranjeros.
- `backfillMipeOwnership()` usa causalidad; un Incident legacy compartido por varias empresas se materializa por tenant en vez de adjudicarse arbitrariamente.
- `mipeTenantState.js` compone MIPE con ownership de inventario/costos; las superficies MIPE consumen estado tenant-scoped.

### Evidencia

- `tests/m3-2-mipe-tenancy.test.mjs` + `tests/m3-2-mipe-tenancy-ui.test.mjs`.
- Quality #1945: **994/994**, todos los gates verdes.

## M32-F003 — cierre verificado

### Solución

- `src/services/mipeCommand.js` expone operaciones explícitas; no acepta recipes arbitrarios.
- `manage_mipe` protege catálogo/hallazgos/seguimiento/programación; `execute_treatments` protege ejecución.
- Firma estable + receipt `(organizationId, commandId)` permiten replay efecto-único y colisión fail-closed.
- Cambio de tenant entre intención y commit falla cerrado.
- `executeCoreOperationCommand()` garantiza `core.operation.requested → commit → completion` con correlación/causalidad deterministas.
- Incidents, Findings, Treatments, Dashboard, HouseMap y MaterialPlantMipePanel pasan por `useMipeCommandStore()`.
- Se eliminaron mutadores MIPE directos y publicación manual de eventos; Dashboard registra seguimiento como `Seguimiento` explícito.

### Evidencia

- `tests/m3-2-mipe-command.test.mjs` + `tests/m3-2-mipe-command-ui.test.mjs`.
- Quality #1980: rojo útil **1007/1009**, únicamente por dos contratos UI históricos que exigían mutadores eliminados.
- Quality #1983: **1009/1009**, todos los gates verdes.
- Commit documental `acd135e250dfd504bf258a44ecbdff2e90453e66`; Quality #1986 verde.

## M32-F004 — cierre verificado

### Problema reproducido

Con dos dispositivos y command IDs diferentes, ambos podían partir del mismo saldo/versiones locales y ejecutar contra el mismo lote. El replay local de F003 no resuelve esa carrera porque cada dispositivo puede presentar una intención válida distinta antes de conocer la escritura del otro.

### Solución

- `src/services/mipeTreatmentTransaction.js` construye una unidad atómica de **exactamente cinco consecuencias**: `inventoryLots`, `inventoryMovements`, `treatments`, `findings`, `costEntries`.
- Lote, Treatment y Finding llevan `_syncVersion` previa; Movement y Cost nuevos parten de versión 0.
- `supabase/migrations/20260817010000_mipe_treatment_execution.sql` crea el receipt remoto y RPC `commit_mipe_treatment_execution` con sesión, membresía, `execute_treatments`, site scope, advisory lock y `FOR UPDATE`.
- Todas las versiones se preflightan antes del primer write; un conflicto revierte la unidad completa.
- El servidor exige Treatment remoto `Programado`, producto/lote/sede coherentes y saldo remoto igual a `balanceBefore`.
- Receipt remoto `(organization_id, command_id)` permite recovery tras respuesta perdida sin doble consumo; colisión de contenido falla cerrado.
- Confirmación parcial, extranjera o duplicada no se hidrata.
- `sync:false` evita reencolar consecuencias ya confirmadas por RPC.

### Evidencia

- `tests/m3-2-mipe-inventory-concurrency.test.mjs`: nueve escenarios adversariales de conjunto atómico, carrera entre dos dispositivos, respuesta perdida, cambio de tenant y confirmaciones hostiles.
- Quality #1997: rojo útil **1013/1018** por fixture sin Incidents causales; tenancy falló cerrado correctamente.
- Corrección exclusiva del fixture: `271503e48034461ce13c55b56620eda5dc6759e5`.
- Quality #2000: **1018/1018**, todos los gates verdes.
- Cierre documental `fe26cade4990fb05b23faf2de5a0bf6200f8ef34`; Quality #2002 verde.

## M32-F005 — cierre verificado

### Problema reproducido

Aunque F003 ya obligaba a escribir mediante commands, un Finding todavía podía reescribir `createdAt` y `status`, cerrarse fuera de un grafo canónico y eliminarse físicamente. Eso protegía el canal de escritura, pero no la historia agronómica. La reauditoría también encontró que un retry post-commit podía volver a planear una transición contra el estado ya avanzado y fallar aun cuando el receipt demostraba que el efecto ya había ocurrido.

### Solución

- `src/domain/mipeFindingWorkflow.js` materializa historial append-only dentro del mismo Finding mediante eventos `CREATED`, `IMPORTED`, `CORRECTION` y `TRANSITION`.
- Finding nuevo solo puede iniciar en `Detectado`. Un Finding legacy conserva explícitamente su estado actual mediante `IMPORTED`; si carece de fecha se usa epoch neutro `1970-01-01T00:00:00.000Z`, nunca “ahora”.
- Grafo explícito: evaluación, aprobación de tratamiento, inicio de tratamiento, seguimiento y cierres terminales `Resuelto`, `Falso positivo` o `Planta eliminada`.
- Estados terminales no pueden reabrirse mediante un command nuevo.
- `CORRECT_FINDING` y el alias legacy `UPDATE_FINDING` son correcciones auditables: requieren motivo y solo permiten `incidentId`, `severity`, `notes`, `action`, `responsible` y `followUpDate`.
- `createdAt`, `reportedAt`, `status`, target, ownership, cierre e historial están prohibidos. Una clave no autorizada falla explícitamente antes de `core.operation.requested`, receipt o mutación; no se ignora silenciosamente.
- Cada corrección agrega before/after; ninguna corrección altera el estado del workflow.
- `DELETE_FINDING` falla durante planificación: el hard-delete de evidencia MIPE está prohibido.
- `FindingsPage` elimina edición de fecha original, selector libre de estado y botón Eliminar; ofrece “Corregir” con motivo y solo transiciones devueltas por `availableMipeFindingTransitions()`.
- `HouseMapPage` fija `Detectado` como estado inicial y no permite escoger un estado arbitrario al crear.
- Programar tratamiento agrega `APPROVE_TREATMENT`; ejecutar agrega `BEGIN_TREATMENT → START_FOLLOW_UP`. El historial permanece embebido en `findings`, por lo que F004 conserva exactamente sus cinco colecciones atómicas.
- Idempotencia append-only: `transitionMipeFinding()` y `correctMipeFinding()` verifican primero el `eventId` determinista derivado del command. Un retry idéntico después del primer efecto devuelve la evidencia existente antes de validar contra el estado post-commit; un commandId nuevo sigue sometido a todas las reglas de transición/corrección.

### Pruebas adversariales

- `tests/m3-2-mipe-finding-workflow.test.mjs`: creación, import legacy, corrección before/after, skips, tiempo regresivo, duplicados y adulteración de historial.
- `tests/m3-2-mipe-workflow-command.test.mjs`: creación canónica, corrección, payload hostil con `status + createdAt`, replay de corrección, transición inválida, hard-delete, lifecycle de Treatment y terminal no reabrible.
- `tests/m3-2-mipe-workflow-ui.test.mjs`: UI sin reescritura/hard-delete, estado inicial fijo y preservación del conjunto F004.
- `tests/m3-2-mipe-command.test.mjs` vuelve a ejecutar el mismo Treatment command después de quedar en `Seguimiento` y exige consumo efecto-único.
- `tests/ux-f008-operational-state-feedback.test.mjs` exige fecha original visible pero inmutable y prohíbe reintroducir `DateTimeFields` en Hallazgos.

### Quality y reauditoría

- La primera reauditoría detectó que autoridad/tests F005 existían sin wiring productivo; no se cerró el hallazgo hasta conectar `mipeCommand.js`, `FindingsPage` y `HouseMapPage`.
- Quality #2026: **1032/1034**. Los dos rojos eran contratos históricos: un fixture F003 viajaba hacia atrás en el tiempo y UX-F008 todavía exigía editar la fecha original. Se corrigieron solo las pruebas, no la autoridad.
- Quality #2030: **1033/1034**. El único rojo reveló un defecto productivo real: un retry de `EXECUTE_TREATMENT` encontraba su receipt pero volvía a planear `BEGIN_TREATMENT` desde el Finding ya en `Seguimiento`.
- Fix de replay: `e709e75b67fb25edf2886db1cb6376f4f382cebb`.
- Adversarial adicional de correction replay / HEAD funcional final: `81d6471e03bc441de132031030e9a170ed019fd3`.
- Quality #2034: **verde, 1035/1035 pruebas**, cero fallos; static audit, dependency audit, environment contract, authentication/session audit, coverage gate, production build y production artifact audit verdes.
- Reauditoría desde cierre F004: el delta F005 queda en catálogo, workflow, command boundary, Findings/HouseMap y pruebas. `src/domain/mipeInterventionAuthority.js` proviene del commit preparatorio F006 `8d50e711c45f1998efd1ea4a504dd7740fa66223`, permanece sin imports productivos y **no se atribuye a F005**.

## M32-F006 — cierre verificado

### Problema reproducido

El seguimiento MIPE todavía tenía dos autoridades paralelas: el helper legacy de material vegetal creaba intervenciones con UUID y permitía reescribir responsable, mientras `mipeInterventionAuthority.js` existía aislado. La proyección de revisiones además confundía el vencimiento con la causalidad: podía no reconocer una inspección hecha a tiempo o permitir que intervenciones simultáneas se cerraran entre sí. La reauditoría encontró también riesgos de homónimos cross-tenant, `treatmentId` no verificado, un `plantEvent` impropio para target `POSITION` y una vía directa de reasignación fuera del command boundary.

### Solución

- `src/domain/mipeInterventionAuthority.js` queda como autoridad canónica de Intervention y se conecta a `RECORD_INTERVENTION` / `REASSIGN_INTERVENTION` en `src/services/mipeCommand.js`.
- Cada Intervention congela `organizationId`, sede, Finding, target `POSITION` o `MATERIAL_PLANT`, actor, evidencia temporal y, cuando aplica, snapshot de Treatment. Un `treatmentId` recibido del cliente solo se conserva si el Treatment fue resuelto y verificado contra la misma empresa, sede y Finding.
- La identidad de la intervención deriva del command; replay y colisiones se someten al receipt tenant-aware del command boundary.
- `assignmentHistory` es append-only: una reasignación agrega evento con responsable anterior/nuevo, actor y fecha. El mismo command de reasignación es idempotente por `eventId` y no vuelve a modificar historia.
- `src/domain/mipeReviewTasks.js` queda como proyección de solo lectura: se eliminó `reassignMipeReviewTask`, por lo que ya no existe un mutador directo que reescriba responsable.
- Una obligación de revisión solo queda `Completada` por un `Seguimiento` posterior a la intervención origen. Puede ocurrir antes o exactamente en la fecha límite; una intervención simultánea no satisface causalidad y un Treatment posterior tampoco sustituye la evidencia de seguimiento.
- La resolución de tareas usa identidad compuesta tenant+Finding, filtra por organización antes de proyectar y falla cerrado ante Finding duplicado same-tenant, ownership ambiguo o evidencia legacy sin ownership que pretenda completar una tarea tenant-owned.
- Target `POSITION` no genera un falso `plantEvent` material. Para `MATERIAL_PLANT`, el target se toma del snapshot canónico y el evento auxiliar usa identidad tenant-compuesta `${organizationId}:${interventionId}:plant-event`, evitando colisión si dos empresas reutilizan el mismo commandId.

### Pruebas adversariales

- `tests/m3-2-mipe-intervention-authority.test.mjs`: target/actor/Treatment snapshots, fechas, Finding cerrado, homónimos cross-tenant, revisión anticipada/puntual, simultaneidad, POSITION vs MATERIAL_PLANT, reasignación append-only y replay.
- `tests/m3-2-mipe-intervention-bypass-reaudit.test.mjs`: prohíbe reintroducir el mutador de reasignación legacy y exige routing productivo por la autoridad canónica.
- La reauditoría adicional cubre Treatment posterior que no satisface follow-up, intervención legacy sin ownership, Finding tenant-owned vs unowned, duplicado same-tenant, filtro por organización, `treatmentId` no verificado y commandId homónimo entre empresas con conservación de ambos eventos materiales.

### Quality y reauditoría

- Quality #2048: **1041/1043**. Las ocho adversariales F006 iniciales pasaron; los dos rojos estaban en el contrato histórico de tareas y revelaron que dos intervenciones con el mismo timestamp no deben completar mutuamente una obligación.
- Se corrigió la causalidad a `performedAt > source.performedAt`, manteniendo que una revisión anticipada o exacta al vencimiento sí es válida.
- Quality #2074 sobre `fe5e6c27682bead1a33afc39b3032186841e9749`: **1051/1052**. El único rojo era una expectativa del fixture: una tarea a 23 horas del vencimiento es correctamente `Próxima`, no `Pendiente`; no hubo defecto productivo.
- Corrección exclusiva del test: `ba4f42943b9d5e7cbc04fd8809091e250d00790a`.
- Quality #2076 sobre `ba4f42943b9d5e7cbc04fd8809091e250d00790a`: **verde, 1052/1052 pruebas**, cero fallos; el workflow `Quality` concluyó `success`.
- Reauditoría final: no queda import productivo de `appendMipeIntervention` ni `reassignMipeReviewTask`; creación y reasignación pasan por la autoridad canónica, la proyección es tenant-aware y los eventos materiales están namespaced por organización.
- Cierre documental `7819e9736e43cd937879f741c3dc4597f030f044`; Quality #2078 verde.

## M32-F007 — cierre verificado

### Problema reproducido

La identidad Product existía en Inventario, pero el flujo productivo MIPE no congelaba su perfil técnico al programar. `executeTreatment()` volvía a leer `cost`, `reentryHours` y `withdrawalDays` del Product mutable, de modo que editar el catálogo después de aprobar un Treatment podía reescribir retroactivamente su costo, reentrada y carencia. Además, Incidents podían eliminarse físicamente, material vegetal aceptaba tipos libres y existía una vía de Intervention `Tratamiento` con producto/dosis textual sin Treatment canónico.

### Solución

- `src/domain/mipeCatalogAuthority.js` define la autoridad sanitaria de catálogo sin duplicar Inventario: Incident tiene categoría/riesgo/vigencia/lifecycle y Product compartido produce un snapshot técnico ejecutable MIPE.
- Incident nuevo conserva identidad, ownership, nombre científico, descripción y vigencia. `ARCHIVE_INCIDENT` agrega lifecycle append-only; `DELETE_INCIDENT` queda únicamente como alias de compatibilidad que **archiva**, nunca elimina.
- Nuevos Findings de Position y material vegetal deben resolver un Incident activo, no archivado y vigente del tenant activo. Material vegetal persiste `incidentId` canónico y deriva el nombre desde el catálogo, no desde texto libre.
- `SCHEDULE_TREATMENT` construye `productSnapshot` tenant/site-aware con nombre, categoría, ingrediente activo, fabricante, registro técnico, unidad, rango/unidad de dosis, costo, reentrada, carencia, vigencia y `technicalRevision`.
- La unidad de dosis solicitada debe coincidir con el perfil técnico, y la unidad física ejecutable debe corresponder: `mL/* → mL`, `g/* → g`.
- `executeTreatment()` valida el snapshot a la fecha de ejecución y calcula costo/reentrada/carencia desde la evidencia congelada. Editar o desactivar el Product vivo después de aprobar no modifica el Treatment ya programado.
- Treatments legacy sin snapshot conservan fallback explícito al Product vivo para compatibilidad histórica; toda nueva programación por `mipeCommand` nace con snapshot.
- La transacción F004 continúa con **exactamente cinco colecciones**: el snapshot vive anidado dentro de Treatment, no crea una sexta consecuencia.
- Una Intervention de tipo `Tratamiento` exige un Treatment canónico verificado del mismo Finding/tenant/sede. El panel material deja únicamente Seguimiento rápido; los tratamientos reales pasan por Treatments MIPE con Product/Lot/costo/restricciones.
- `InventoryPage` captura fabricante, registro técnico/ICA, vigencia y revisión técnica sobre la misma colección `products`, estampa `organizationId` y rechaza desde UI combinaciones incoherentes entre unidad de dosis y unidad de inventario.
- `TreatmentsPage` bloquea la unidad de dosis al perfil seleccionado, muestra registro/vigencia/reentrada/carencia y usa `productSnapshot` para historia visible.

### Pruebas adversariales

- `tests/m3-2-mipe-catalog-authority.test.mjs`: snapshot técnico completo/inmutable, tenant/sede/categoría/vigencia, unidad y rango de dosis, archivado/replay de Incident.
- `tests/m3-2-mipe-incident-product-command.test.mjs`: archivado no destructivo, alias DELETE→archive, Incident archivado/futuro, Product homónimo cross-tenant, snapshot programado, mutación posterior del Product vivo, expiración al ejecutar, unidad incompatible y Treatment textual prohibido.
- La reproducción financiera/agronómica programa con costo/reentrada/carencia A, muta el Product vivo a valores B y exige que la ejecución siga usando A; también exige no descontar inventario si el snapshot ya expiró.
- `tests/m3-2-mipe-incident-product-ui.test.mjs`: no hard-delete en catálogo, Incidents activos en croquis/material, Seguimiento-only rápido, doseUnit bloqueada, metadatos técnicos de Inventario y coherencia `doseUnit ↔ unit`.
- Suites F006 se adaptaron al contrato endurecido sin debilitar sus invariantes: Treatment posterior usa Treatment canónico; homónimos cross-tenant y eventos materiales siguen cubiertos.

### Quality y reauditoría

- Quality #2108 sobre `7142b049c22655a3fe62b76fd923646719696783`: **1068/1072**. Los cuatro rojos eran contratos históricos: tres fixtures F006 todavía fabricaban Treatment textual y UX-F008 esperaba el copy anterior. La autoridad F007 no falló.
- Se migraron únicamente esos contratos. Quality #2114 quedó verde sobre `cee46f3f26dc9d91b16e16b2e532c2d3bbaf74f7`.
- Reauditoría final añadió validación de coherencia de unidad en la captura de Inventario y su prueba estática; no modificó dominio ni la transacción F004.
- HEAD funcional final: `9cc5239de5ebcea606020ad9dab40918ceda7a13`.
- Quality #2118: **verde, 1072/1072 pruebas**, cero fallos.
- Reauditoría: no queda hard-delete productivo de Incident; `DELETE_INCIDENT` es alias no destructivo; nuevos Findings requieren Incident usable; nuevas programaciones nacen con snapshot; costo/reentrada/carencia se calculan desde `profile=snapshot||product`; Treatment textual sin Treatment canónico falla antes de evento/commit.
- Cierre documental `1e016f168c8e7370584e8fe1f179c4e82586b714`; Quality #2120 verde.

## M32-F008 — cierre verificado

### Problema reproducido

El backend genérico `erp_records` ya aceptaba cualquier colección, pero el cliente no materializaba ni sincronizaba por completo la evidencia F006/F003. `mipeInterventions` y `mipeCommandReceipts` faltaban del allowlist de sync y de la normalización persistente. Además, los receipts usaban `commandId` como identidad contractual pero no tenían necesariamente `id`, mientras el motor genérico esperaba `record.id`; habilitarlos sin corregir esa diferencia habría creado identidades vacías/colisiones y pérdida de idempotencia entre dispositivos. El backfill causal F002 existía en dominio, pero tampoco formaba parte del pipeline de persistencia/bootstrap.

### Solución

- `src/services/mipePersistenceMigration.js` introduce una migración MIPE dedicada (`MIPE_PERSISTENCE_VERSION=1`) sin reabrir el schema global M3.1: materializa `mipeInterventions` y `mipeCommandReceipts`, aplica `backfillMipeOwnership()` y normaliza cada receipt a `id = commandId`.
- Identidad durable de receipt: `(organizationId, commandId)`. Duplicados idénticos convergen; dos signatures contradictorias para la misma identidad fallan cerrado durante migración.
- `safeStorage.js` ejecuta la migración MIPE en load/save, después de la migración general/material y antes de persistir la caché segmentada.
- `remoteBootstrap.js` ejecuta la misma migración tras hidratación autoritativa; sus helpers de identidad aceptan `id || commandId`, por lo que un dispositivo nuevo no depende de haber cargado una caché legacy antes.
- `SYNCABLE_COLLECTIONS` incorpora `mipeInterventions` y `mipeCommandReceipts`.
- `syncEngine.js` define identidad sincronizable como `id || commandId`; un registro realmente sin identidad falla cerrado. Los upserts estampan `id=recordId` y `_organizationId`, y los tombstones solo afectan la identidad del tenant activo.
- Interventions conservan `assignmentHistory`, snapshots y ownership durante cache/sync/bootstrap; los homónimos de otra empresa permanecen intactos.
- Mutaciones offline pendientes del tenant activo se superponen al snapshot remoto en bootstrap, sin destruir el homónimo extranjero.
- Un receipt hidratado desde PostgreSQL permite que el mismo command vuelva a ejecutarse como replay efecto-único después de recarga/dispositivo nuevo.
- No se crean tablas MIPE nuevas ni RPCs redundantes: `003_sync_transport.sql`/`007_remote_bootstrap.sql` ya proveen almacenamiento genérico por `(organization_id, collection, record_id)`.
- F004 no se expande: el receipt genérico MIPE no forma parte de `MIPE_TREATMENT_TRANSACTION_COLLECTIONS`; la RPC de Treatment mantiene exactamente lote + movimiento + Treatment + Finding + costo y `sync:false` para consecuencias ya confirmadas remotamente.

### Pruebas adversariales

- `tests/m3-2-mipe-persistence-sync.test.mjs`: migración dedicada, backfill causal, receipt `id=commandId`, contradicción fail-closed, caché tenant-aware, cola sync, bootstrap, tombstone, pending offline overlay, homónimos cross-tenant y replay tras hidratar receipt.
- `tests/m3-2-mipe-persistence-receipt-reaudit.test.mjs`: receipts idénticos convergen y un tombstone de A conserva el homónimo de B.
- La suite verifica explícitamente que `MIPE_TREATMENT_TRANSACTION_COLLECTIONS` sigue siendo `inventoryLots`, `inventoryMovements`, `treatments`, `findings`, `costEntries` y que `mipeTreatmentTransaction.js` no incorpora `mipeCommandReceipts`.

### Quality y reauditoría

- Quality #2132: **1080/1081**. El único rojo era una aserción estática de la prueba que buscaba el nombre interno antiguo `CANONICAL_COLLECTIONS`; producción exponía correctamente `MIPE_TREATMENT_TRANSACTION_COLLECTIONS` con las mismas cinco consecuencias.
- Se corrigió exclusivamente esa aserción y se añadió reauditoría de convergencia/tombstone de receipts.
- HEAD funcional final: `1faa98c...` (commit que contiene la reauditoría final de receipts).
- Quality #2135: **verde, 1083/1083 pruebas**, cero fallos; workflow `Quality` concluido `success`.
- Reauditoría final: backend genérico intacto; no hay nueva autoridad SQL paralela; cache/bootstrap/sync comparten la misma identidad tenant-aware; receipts contradictorios fallan y los idénticos convergen; F004 conserva su atomicidad de cinco colecciones.

## Orden de cierre

1. **F001 Domain authority — Verified.**
2. **F002 Tenancy — Verified.**
3. **F003 Commands/permissions/events — Verified.**
4. **F004 Treatment/inventory transaction — Verified.**
5. **F005 Workflow/history — Verified.**
6. **F006 Follow-up/interventions — Verified.**
7. **F007 Incident/product authority — Verified.**
8. **F008 Persistence/sync — Verified.**
9. **F009 Operational restrictions** — reentrada, carencia y disponibilidad como autoridad proyectable.
10. **F010 Dashboard/croquis/context** — contexto jerárquico persistente y acciones desde croquis.
11. **F011 Passport/Knowledge Graph** — trazabilidad explicable end-to-end.
12. **F012 Adversarial verification** — reauditoría transversal y cierre.

## Criterios de cierre M3.2

1. Entidades MIPE tenant-owned e identidad estable.
2. Ningún lookup operativo depende de ID global.
3. Ninguna UI MIPE significativa escribe directamente en Store.
4. Mutaciones por command boundary permission-aware e idempotente.
5. Ejecución de tratamiento atómica respecto de lote, movimiento, costo, Treatment, Finding y evidencia.
6. Workflow e historial append-only sin reescritura silenciosa.
7. Seguimientos/intervenciones persistentes, tenant-aware y causales.
8. Producto/dosis/lote/reentrada/carencia ligados a evidencia verificable.
9. Schema/cache/bootstrap/sync/tombstones preservan `(organizationId,id)` y fallan cerrado.
10. Dashboard/croquis respetan Empresa→Sede→Nave→Cama→Planta.
11. Passport/Knowledge Graph explican la cadena MIPE sin nodos extranjeros.
12. Quality completo verde y reauditoría final sin P0/P1 abiertos.

## Conteo inicial

- Open: **12**
- P0: **4**
- P1: **8**
- Verified: **0**

## Estado actual

- Verified: **8**
- Open: **4**
- P0 abiertos: **0**
- P1 abiertos: **4**