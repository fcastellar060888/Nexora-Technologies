# Nexora One — Auditoría Forense v3 · M3.2 MIPE

Estado: **AUDIT IN PROGRESS — 5/12 Verified**  
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
| M32-F005 | P1 | **Verified** | Workflow/audit history | Workflow canónico e historial append-only; correcciones with before/after, hard-delete prohibido, UI sin reescritura y replay post-workflow idempotente. Quality #2034. |
| M32-F006 | P1 | **Open** | Follow-up/interventions | Falta unificar causalidad y autoridad de seguimiento entre planta productiva y material vegetal. |
| M32-F007 | P1 | **Open** | Incident/product authority | Falta catálogo técnico, vigencia, restricciones y snapshots ejecutables completos. |
| M32-F008 | P1 | **Open** | Persistence/sync | Falta autoridad completa de schema/migration/cache/bootstrap/sync/tombstones/receipts MIPE. |
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

## Orden de cierre

1. **F001 Domain authority — Verified.**
2. **F002 Tenancy — Verified.**
3. **F003 Commands/permissions/events — Verified.**
4. **F004 Treatment/inventory transaction — Verified.**
5. **F005 Workflow/history — Verified.**
6. **F006 Follow-up/interventions** — unificar seguimiento productivo/material vegetal.
7. **F007 Incident/product authority** — catálogos/referencias/snapshots ejecutables.
8. **F008 Persistence/sync** — schema/cache/bootstrap/sync/tombstones/receipts.
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

- Verified: **5**
- Open: **7**
- P0 abiertos: **0**
- P1 abiertos: **7**
