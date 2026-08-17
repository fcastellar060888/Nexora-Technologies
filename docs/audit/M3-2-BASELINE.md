# Nexora One — Auditoría Forense v3 · M3.2 MIPE

Estado: **AUDIT IN PROGRESS — 3/12 Verified**  
Base certificada: M3.1 Irrigation & MIRFE, head `6943ad022ba7c88fc7eb1b5111552f4b06b22992`, Quality #1919 verde.  
Bloque de arquitectura: M3 — Agronomy Operational (`MIRFE + MIPE + Inventory integration`).  
Normativa: `docs/NEXORA_DOMAIN_MODEL_V1.md` + `docs/NEXORA_PRODUCT_DOCTRINE.md`.  
Método: Audit → Fix → Test → Quality Gate → Re-Audit → Close.

## Alcance M3.2

M3.2 audita MIPE como autoridad operativa completa, no como conjunto de pantallas. Incluye:

- incidencia/plaga/enfermedad y catálogo técnico;
- hallazgo por planta/Position y material vegetal;
- severidad, estado, seguimiento, falso positivo y resolución;
- intervención y tratamiento;
- producto, dosis, volumen, lote físico, consumo y costo;
- reentrada y período de carencia;
- bloqueo/liberación operativa de material vegetal;
- permisos, command boundary, eventos, Ledger/Timeline;
- tenancy, persistencia, caché, bootstrap y sync;
- dashboard, croquis y contexto sede/nave/cama/planta;
- Passport y Knowledge Graph;
- pruebas adversariales multiempresa, retry, concurrencia y referencias extranjeras.

## Evidencia reproducible de apertura

- `src/domain/mipe.js` resuelve cama/nave/sede/planta, hallazgo, producto, lote y tratamiento mediante `.find(x => x.id === ...)` global. F001/F002/F003 envuelven ya las rutas operativas con autoridad, tenancy y commands; la carrera remota de ejecución permanece aislada en F004.
- `executeTreatment()` descuenta inventario, cambia tratamiento/hallazgo y agrega costo dentro de una transformación local. F003 le da command ID, permiso, tenancy y replay seguro local; F004 conserva la transacción remota multi-dispositivo.
- `FindingsPage`, `TreatmentsPage`, `IncidentsPage` y `MipeDashboardPage` ya no escriben mediante el Store global. F003 reemplazó sus mutaciones MIPE por operaciones explícitas del command boundary.
- `HouseMapPage` registra hallazgos mediante command y mantiene la edición no-MIPE de genética protegida por ownership compuesto.
- `MaterialPlantMipePanel` ya no publica eventos manualmente ni llama mutadores MIPE de dominio; alta, intervención y resolución pasan por el command boundary. La autoridad especializada de seguimiento/material vegetal continúa en F006/F009.
- `mipeInterventions` no forma parte aún de la autoridad de persistencia/sync certificada; F008 mantiene ese alcance.
- `manage_mipe` y `execute_treatments` se revalidan ahora en el command boundary antes del evento de intención. La persistencia/sync de recibos se mantiene en F008.
- La caché segmentada histórica acepta registros sin ownership en la partición activa; F002 introduce resolución/backfill fail-closed, mientras F008 integrará schema/cache/bootstrap/sync.
- `tests/mipe.test.mjs` cubría matemática de dosis, ejecución local, consumo, costo, reentrada/carencia e inventario insuficiente. F001–F003 agregan autoridad, tenancy, permisos, replay, cambio de tenant y contratos UI; concurrencia remota/Graph permanecen separados.

## Hallazgos iniciales

| ID | Sev. | Estado | Área | Hallazgo |
|---|---:|---|---|---|
| M32-F001 | P0 | **Verified** | Domain authority | `mipeAuthority.js` establece Incident/Finding/Treatment/Intervention tenant-owned, profundamente inmutables, con composición y snapshots fail-closed. Quality #1926. |
| M32-F002 | P0 | **Verified** | Tenancy | `mipeTenancy.js` y la vista MIPE tenant-scoped aíslan IDs homónimos, ownership causal, scope/merge/backfill y las superficies principales. Quality #1945. |
| M32-F003 | P0 | **Verified** | Commands/permissions/events | Once operaciones explícitas pasan por boundary permission-aware e idempotente; seis superficies MIPE sin mutación directa ni publicación manual; eventos requested/completion deterministas. Quality #1983. |
| M32-F004 | P0 | **Open** | Treatment/inventory transaction | Ejecutar un tratamiento consume lote, crea movimiento/costo y cambia estados localmente, sin precondición/transacción remota multi-dispositivo. Dos dispositivos pueden competir sobre el mismo stock. |
| M32-F005 | P1 | **Open** | Workflow/audit history | Un hallazgo puede editar fecha/estado arbitrariamente, cerrarse sin workflow y borrarse físicamente. No existe transición canónica ni historial append-only suficiente para auditoría agronómica. |
| M32-F006 | P1 | **Open** | Follow-up/interventions | Seguimientos/intervenciones de material vegetal requieren unificación causal y persistencia certificada con MIPE productivo. |
| M32-F007 | P1 | **Open** | Incident/product authority | Incidencias y productos MIPE requieren catálogo técnico, restricciones, vigencia y snapshots ejecutables más allá del aislamiento tenant ya certificado. |
| M32-F008 | P1 | **Open** | Persistence/sync | `findings/incidents/treatments/mipeInterventions` y recibos MIPE no forman aún una autoridad completa de schema, migration, cache, bootstrap, sync y tombstones por `(organizationId,id)`. |
| M32-F009 | P1 | **Open** | Operational restrictions | Reentrada, carencia y bloqueo/liberación de material vegetal existen como reglas parciales, pero no como restricciones tenant-aware proyectables y verificables desde una autoridad común. |
| M32-F010 | P1 | **Open** | Dashboard/croquis/context | El dashboard está tenant-scoped y sus acciones pasan por commands, pero falta cerrar el contexto jerárquico Empresa → Sede → Nave → Cama → Planta y su integración con croquis. |
| M32-F011 | P1 | **Open** | Passport/Knowledge Graph | Passport/Graph muestran MIPE legacy de forma parcial, pero no explican de extremo a extremo Finding → Incident → Intervention/Treatment → Product/Lot → Restriction/Resolution con tenancy canónica. |
| M32-F012 | P1 | **Open** | Adversarial verification | Falta la reauditoría transversal de doble ejecución, carrera de stock, hard-delete, persistencia/sync y proyección Graph sin fuga. |

## M32-F001 — cierre verificado

### Solución

- `src/domain/mipeAuthority.js` define contratos canónicos para `Incident`, `Finding`, `Treatment` e `Intervention` con `organizationId` y, cuando aplica, `siteId` heredados de la autoridad causal.
- `Finding` admite objetivos `POSITION` y `MATERIAL_PLANT`, severidad 1–4, estado canónico, fechas verificadas y evidencia deduplicada e inmutable.
- La composición `Target + Incident → Finding` falla cerrado si las referencias pertenecen a organizaciones incompatibles.
- `Treatment` exige Finding/Product del mismo tenant/sede, valida dosis/unidad/volumen y congela un snapshot ejecutable de nombre, unidad, límites de dosis, reentrada, carencia y costo.
- Las cuatro unidades de dosis (`mL/L`, `g/L`, `mL/100 L`, `g/100 L`) derivan cantidad total e inventario compatible de manera explícita.
- `Intervention` hereda el tenant del Finding; una intervención de tratamiento exige un Treatment del mismo Finding y una revisión futura no puede preceder el instante ejecutado.
- Los objetos y sus estructuras anidadas quedan profundamente congelados para impedir reescritura accidental de la evidencia de dominio.

### Pruebas adversariales

`tests/m3-2-mipe-domain-authority.test.mjs` cubre:

- IDs idénticos entre `org-a` y `org-b`;
- Incident cross-tenant;
- severidad, target y fechas inválidas;
- las cuatro unidades/cantidades de dosis;
- Product de otra empresa, sede equivocada, dosis fuera de etiqueta y unidad incompatible;
- snapshot profundamente inmutable;
- Treatment homónimo entre tenants;
- Intervention causal, Follow-up sin tratamiento y tiempo regresivo;
- guard genérico organización/sede.

### Quality y reauditoría

- Autoridad: `1579126ed701b016ed7bfae824185f894be1a001`.
- Suite adversarial / HEAD certificado F001: `94d5cf6282193c8972db957eaaacb9db7bca9b85`.
- Quality #1926: **verde**, **981/981** pruebas en 203 archivos.
- Static audit, dependency audit, environment contract, authentication/session audit, coverage gate, production build y production artifact audit: verdes.
- Reauditoría: F001 añadió únicamente autoridad pura + pruebas sobre la base documental; no conectó UI, Store ni sync. Tenancy y commands permanecieron separados en F002/F003.

## M32-F002 — cierre verificado

### Solución

- `src/domain/mipeTenancy.js` resuelve ownership de Findings por sede/Position/material vegetal; Treatment por Finding/Product/Lot; Intervention por Finding/Treatment; nunca adjudica un registro multiempresa ambiguo por el tenant activo.
- Un ID puede repetirse entre organizaciones. `findMipeRecord()` exige una identidad única dentro del tenant y falla cerrado ante homónimo extranjero, ownership ambiguo o duplicado same-tenant.
- `scopeMipeState()` crea una vista tenant-only de empresa, sede, nave, cama, Position, material vegetal, productos, lotes, costos, Incidents, Findings, Treatments e Interventions.
- `mergeMipeState()` solo recompone la partición MIPE activa y preserva homónimos extranjeros. El adaptador de estado compone además `mergeIrrigationMirfeState()` para preservar identidad compuesta en lote/movimiento/costo.
- `ownMipeRecord()` valida referencias antes de estampar `organizationId`; un Incident/Product/Lot extranjero no puede convertirse en local por una mutación de UI.
- `backfillMipeOwnership()` sigue causalidad y no contexto activo. Si un Incident legacy global es usado por Findings de dos organizaciones, genera una copia tenant-owned por organización con el mismo ID en vez de asignarlo arbitrariamente.
- Hallazgos ambiguos sobre un Position homónimo permanecen sin ownership y fuera de la vista operativa.
- Las cuatro superficies MIPE principales dejaron de leer el Store global y consumen una vista tenant-scoped; F003 evolucionó esa vista a `useMipeCommandStore()` sin perder el aislamiento.
- F002 no prohíbe todavía hard-delete del registro propio ni eleva schema/sync: F005 y F008 conservan esos alcances.

### Pruebas adversariales

- `tests/m3-2-mipe-tenancy.test.mjs`: 11 casos para IDs homónimos, Position ambiguo, inferencia causal, clone de Incident compartido, Treatment/Intervention causal, ownership contradictorio, scope, merge, referencias extranjeras, preservación del homónimo y duplicados same-tenant.
- `tests/m3-2-mipe-tenancy-ui.test.mjs`: contrato tenant-scoped evolucionado para admitir el command store sin reintroducir `useStore()` global; también fija la composición de ownership MIPE + inventario.
- Quality #1931 validó la autoridad pura con **992/992** antes de conectar la UI tenant-scoped.
- Quality #1945 validó el HEAD completo de F002 con **994/994** pruebas.

### Quality y reauditoría

- Autoridad tenancy: `b2e9166638c1d3c8c31a3d76846a1b097387e1fb`.
- Fixtures adversariales corregidos: `03c6db6f22a498edde720add9c13855b834aa2e6`.
- Adapter/UI y contrato final F002 culminaron en `fb876a7faecb9be4972be1a7d0be11e6a9148752`.
- Quality #1945: **verde**, **994/994** pruebas; todos los gates completos verdes.
- Reauditoría: cálculos/selectores legacy reciben únicamente la partición activa; el merge preserva extranjeros y falla ante identidad ambigua. F003 reemplazó luego las mutaciones directas y F008 conserva persistencia remota.

## M32-F003 — cierre verificado

### Solución

- `src/services/mipeCommand.js` define **11 operaciones explícitas**; no acepta recipes arbitrarios que puedan recrear un `update()` genérico disfrazado.
- `manage_mipe` se exige para catálogo, hallazgos, seguimiento y programación; `execute_treatments` se exige separadamente para la ejecución. El permiso se revalida antes de publicar `core.operation.requested`.
- Cada comando usa firma canónica estable por operación/agregado/input y un recibo acotado por organización + `commandId`. Replay idéntico no repite el efecto; reutilizar el ID con otro contenido falla antes de publicar.
- El commit revalida que la empresa activa no haya cambiado entre intención y confirmación. Un cambio de tenant deja como máximo la intención y no publica completion ni aplica la mutación.
- `executeCoreOperationCommand()` impone `requested → commit → completion`, con `eventId`, `correlationId` y `causationId` deterministas.
- `src/services/mipeCommandStore.js` colapsa duplicados simultáneos en vuelo y conserva `commandId`/`occurredAt` para un retry tras error.
- La mutación tenant-aware se separó en `src/services/mipeTenantState.js`, módulo puro sin dependencia de React; `mipeTenantStore.js` queda como hook delgado.
- Seis superficies escritoras —Incidents, Findings, Treatments, Dashboard, HouseMap y MaterialPlantMipePanel— pasan por `useMipeCommandStore()` y `MIPE_OPERATIONS`.
- `TreatmentsPage` ya no invoca directamente `scheduleTreatment()`/`executeTreatment()`. `MaterialPlantMipePanel` ya no publica eventos manuales ni llama `appendMaterialPlantFindings`, `appendMipeIntervention` o `resolveMaterialPlantFinding` desde UI.
- El seguimiento rápido del Dashboard declara explícitamente `type:'Seguimiento'`; se elimina la dependencia del default legacy `Tratamiento`, que podía clasificar incorrectamente una inspección.
- `HouseMap` mantiene una edición no-MIPE de genética fuera del command MIPE, pero esa escritura valida la organización de cada Position mediante identidad compuesta.
- `RECORD_INTERVENTION` invoca el helper legacy sobre `scopeMipeState()` y estampa una identidad determinista/tenant-owned antes del merge.
- F003 **no** atribuye la carrera remota de stock (F004), el hard-delete/workflow (F005), la autoridad especializada material (F006/F009) ni persistencia/sync de recibos (F008).

### Pruebas adversariales

`tests/m3-2-mipe-command.test.mjs` cubre:

- secuencia requested/completion y causalidad determinista;
- replay efecto-único y colisión de `commandId`;
- permiso denegado antes de evento/commit;
- separación `manage_mipe` vs `execute_treatments`;
- referencia cross-tenant antes de intención;
- cambio de empresa entre intención y commit;
- ejecución local únicamente sobre lote activo y replay sin doble consumo;
- intervención resuelta contra el Finding del tenant activo.

`tests/m3-2-mipe-command-ui.test.mjs` fija:

- seis superficies sobre command store;
- ausencia del mutador tenant legacy en páginas principales;
- ausencia de mutadores de tratamiento directos;
- ausencia de publicación manual y helpers de material vegetal en UI;
- Dashboard con Follow-up explícito y reasignación por command;
- HouseMap con alta MIPE por command y edición genética tenant-guarded;
- split de permisos, core operation causality, `applyOnce` y `commandId` en el servicio.

### Quality y reauditoría

- F003 acumuló el boundary/event catalog, seis conversiones UI, separación pura de tenancy y suites adversariales; el HEAD funcional final es `ecee772d33e6ae364d062d5be3940ead53ea7f40`.
- Quality #1980 fue **rojo útil: 1007/1009**. Las únicas dos fallas eran contratos UI históricos que exigían literalmente `appendMaterialPlantFindings` y `appendMipeIntervention`, precisamente las llamadas directas eliminadas por F003.
- Esos contratos se actualizaron para exigir command boundary y prohibir los mutadores antiguos, sin introducir código muerto.
- Quality #1983: **verde, 1009/1009 pruebas**. Static audit, dependency audit, environment contract, authentication/session audit, coverage gate, production build y production artifact audit: verdes.
- Reauditoría: el delta F003 queda limitado a command/event boundary, seis superficies y sus contratos. No se añadió RPC ni precondición remota de inventario, por lo que F004 permanece como único P0 abierto.

## Orden de cierre

1. **F001 Domain authority — Verified.**
2. **F002 Tenancy — Verified.**
3. **F003 Commands/permissions/events — Verified.**
4. **F004 Treatment/inventory transaction** — cerrar concurrencia y efectos atómicos.
5. **F005 Workflow/history** — transición canónica, falso positivo, resolución y auditoría append-only.
6. **F006 Follow-up/interventions** — unificar seguimiento de planta productiva/material vegetal.
7. **F007 Incident/product authority** — catálogos/referencias/snapshots ejecutables.
8. **F008 Persistence/sync** — schema/cache/bootstrap/sync/tombstones.
9. **F009 Operational restrictions** — reentrada, carencia y disponibilidad como autoridad proyectable.
10. **F010 Dashboard/croquis/context** — vistas y acciones bajo contexto jerárquico persistente.
11. **F011 Passport/Knowledge Graph** — trazabilidad explicable end-to-end.
12. **F012 Adversarial verification** — reauditoría transversal y cierre.

## Criterios de cierre

1. Toda entidad MIPE significativa tiene `organizationId`, identidad estable y referencias verificadas dentro del tenant.
2. Ningún lookup operativo depende de `id` global cuando el mismo ID puede existir en dos empresas.
3. Ninguna UI MIPE significativa escribe directamente en el Store.
4. Crear/editar/transicionar/resolver/programar/ejecutar exige permiso en command boundary y soporta replay seguro.
5. Ejecución de tratamiento es atómica respecto de lote, movimiento, costo, estado y evidencia.
6. Workflow e historial son append-only; un usuario no puede reescribir silenciosamente la historia agronómica.
7. Seguimientos e intervenciones son persistentes, tenant-aware y causales.
8. Dosis/producto/lote/reentrada/carencia quedan ligados a snapshots o referencias canónicas verificables.
9. Schema, cache, bootstrap, sync, upsert y tombstone preservan `(organizationId,id)` y fallan cerrado ante ownership ambiguo.
10. Dashboard/croquis respetan el contexto Empresa → Sede → Nave → Cama → Planta.
11. Passport/Knowledge Graph explican toda la cadena MIPE sin nodos extranjeros.
12. Quality completo verde sin relajar umbrales y reauditoría final sin P0/P1 abiertos.

## Conteo inicial

- Open: **12**
- P0: **4**
- P1: **8**
- Verified: **0**

## Estado actual

- Verified: **3**
- Open: **9**
- P0 abiertos: **1**
- P1 abiertos: **8**
