# Nexora One — Auditoría Forense v3 · M3.2 MIPE

Estado: **AUDIT IN PROGRESS — 2/12 Verified**  
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

- `src/domain/mipe.js` resuelve cama/nave/sede/planta, hallazgo, producto, lote y tratamiento mediante `.find(x => x.id === ...)` global. `scheduleTreatment()` y `executeTreatment()` crean registros sin `organizationId`.
- `executeTreatment()` descuenta inventario, cambia tratamiento/hallazgo y agrega costo dentro de una transformación local, pero no dispone de command ID, permiso de dominio ni transacción remota multi-dispositivo.
- `src/pages/FindingsPage.jsx` consumía `state.findings`, `state.incidents` y `state.houses` globales; editar, cerrar y borrar usaban `useStore().update()` y comparaban exclusivamente por `id`.
- `FindingsPage` permite seleccionar directamente cualquier `findingStatuses`, modificar la fecha original y eliminar físicamente un hallazgo; no existe historial append-only de transición/corrección en esa frontera.
- `src/pages/TreatmentsPage.jsx` consumía hallazgos/productos/lotes globales y llama todavía a `scheduleTreatment()` / `executeTreatment()` mediante una mutación directa; F002 ya recorta esa mutación al tenant y F003 reemplazará el boundary.
- `src/domain/materialPlantMipe.js` contiene reglas valiosas para bloqueo, intervención y resolución, pero `findings` y `mipeInterventions` se resuelven por `id` simple y los registros creados no fijan ownership por sí mismos.
- `mipeInterventions` no forma parte aún de la autoridad de persistencia/sync certificada; F008 mantiene ese alcance.
- Los permisos `manage_mipe` y `execute_treatments` existen en el sistema, pero las mutaciones legacy todavía no pasan por un command boundary MIPE; F003 mantiene ese alcance.
- La caché segmentada histórica acepta registros sin ownership en la partición activa; F002 introduce resolución/backfill fail-closed, mientras F008 integrará schema/cache/bootstrap/sync.
- `tests/mipe.test.mjs` cubría matemática de dosis, ejecución local, consumo, costo, reentrada/carencia e inventario insuficiente. F001/F002 agregan autoridad y tenancy adversarial; retry/concurrencia/Graph permanecen separados.

## Hallazgos iniciales

| ID | Sev. | Estado | Área | Hallazgo |
|---|---:|---|---|---|
| M32-F001 | P0 | **Verified** | Domain authority | `mipeAuthority.js` establece Incident/Finding/Treatment/Intervention tenant-owned, profundamente inmutables, con composición y snapshots fail-closed. Quality #1926. |
| M32-F002 | P0 | **Verified** | Tenancy | `mipeTenancy.js` y `useMipeStore()` aíslan IDs homónimos, ownership causal, scope/merge/backfill y las cuatro superficies MIPE principales. Quality #1945. |
| M32-F003 | P0 | **Open** | Commands/permissions/events | Las mutaciones MIPE usan todavía boundary directo de Store aunque ya scoped. `manage_mipe` / `execute_treatments` no se revalidan en un command boundary; no hay idempotencia, causalidad ni completion events canónicos. |
| M32-F004 | P0 | **Open** | Treatment/inventory transaction | Ejecutar un tratamiento consume lote, crea movimiento/costo y cambia estados localmente, sin precondición/transacción remota multi-dispositivo. Dos dispositivos pueden competir sobre el mismo stock. |
| M32-F005 | P1 | **Open** | Workflow/audit history | Un hallazgo puede editar fecha/estado arbitrariamente, cerrarse sin workflow y borrarse físicamente. No existe transición canónica ni historial append-only suficiente para auditoría agronómica. |
| M32-F006 | P1 | **Open** | Follow-up/interventions | Seguimientos/intervenciones de material vegetal usan `mipeInterventions` sin identidad/ownership remoto certificado; la causalidad intervención → hallazgo → resolución no está unificada con MIPE productivo. |
| M32-F007 | P1 | **Open** | Incident/product authority | Incidencias y productos MIPE requieren catálogo técnico, restricciones, vigencia y snapshots ejecutables más allá del aislamiento tenant ya certificado. |
| M32-F008 | P1 | **Open** | Persistence/sync | `findings/incidents/treatments` legacy y `mipeInterventions` no forman aún una colección canónica completa con schema, migration, cache, bootstrap, sync y tombstones por `(organizationId,id)`. |
| M32-F009 | P1 | **Open** | Operational restrictions | Reentrada, carencia y bloqueo/liberación de material vegetal existen como reglas parciales, pero no como restricciones tenant-aware proyectables y verificables desde una autoridad común. |
| M32-F010 | P1 | **Open** | Dashboard/croquis/context | El dashboard ya está tenant-scoped por F002, pero falta cerrar el contexto operativo jerárquico Empresa → Sede → Nave → Cama → Planta y su integración con croquis/acciones. |
| M32-F011 | P1 | **Open** | Passport/Knowledge Graph | Passport/Graph muestran MIPE legacy de forma parcial, pero no explican de extremo a extremo Finding → Incident → Intervention/Treatment → Product/Lot → Restriction/Resolution con tenancy canónica. |
| M32-F012 | P1 | **Open** | Adversarial verification | Falta la reauditoría transversal de retry, doble ejecución, carrera de stock, hard-delete, persistencia/sync y proyección Graph sin fuga. |

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
- `mergeMipeState()` solo recompone la partición MIPE activa y preserva homónimos extranjeros. El adaptador `useMipeStore()` compone además `mergeIrrigationMirfeState()` para preservar la misma identidad compuesta en lote/movimiento/costo mientras sobreviven las operaciones legacy.
- `ownMipeRecord()` valida referencias antes de estampar `organizationId`; un Incident/Product/Lot extranjero no puede convertirse en local por una mutación de UI.
- `backfillMipeOwnership()` sigue causalidad y no contexto activo. Si un Incident legacy global es usado por Findings de dos organizaciones, genera una copia tenant-owned por organización con el mismo ID en vez de asignarlo arbitrariamente.
- Hallazgos ambiguos sobre un Position homónimo permanecen sin ownership y fuera de la vista operativa.
- `FindingsPage`, `TreatmentsPage`, `IncidentsPage` y `MipeDashboardPage` dejaron de leer el Store global y consumen `useMipeStore()`.
- F002 no prohíbe todavía hard-delete del registro propio ni reemplaza el `update()` directo; esas garantías pertenecen respectivamente a F005 y F003. Tampoco eleva schema/sync: F008 conserva ese alcance.

### Pruebas adversariales

- `tests/m3-2-mipe-tenancy.test.mjs`: 11 casos para IDs homónimos, Position ambiguo, inferencia causal, clone de Incident compartido, Treatment/Intervention causal, ownership contradictorio, scope, merge, referencias extranjeras, preservación del homónimo y duplicados same-tenant.
- `tests/m3-2-mipe-tenancy-ui.test.mjs`: contrato que obliga a las cuatro superficies MIPE principales a usar `useMipeStore()` y evita la reintroducción de `useStore()` global; también fija la composición de ownership MIPE + inventario.
- Quality #1931 validó la autoridad pura con **992/992** antes de conectar la UI tenant-scoped.
- Quality #1945 validó el HEAD completo de F002 con **994/994** pruebas.

### Quality y reauditoría

- Autoridad tenancy: `b2e9166638c1d3c8c31a3d76846a1b097387e1fb`.
- Fixtures adversariales corregidos: `03c6db6f22a498edde720add9c13855b834aa2e6`.
- Adapter/UI y contrato final culminan en `fb876a7faecb9be4972be1a7d0be11e6a9148752`.
- Quality #1945: **verde**, **994/994** pruebas; todos los gates completos verdes.
- Reauditoría: los cálculos y selectores legacy reciben únicamente la partición activa; el merge preserva extranjeros y falla ante identidad ambigua. Las mutaciones directas siguen explícitamente abiertas en F003 y la persistencia remota completa en F008.

## Orden de cierre

1. **F001 Domain authority — Verified.**
2. **F002 Tenancy — Verified.**
3. **F003 Commands/permissions/events** — mover escrituras a boundary idempotente.
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

- Verified: **2**
- Open: **10**
- P0 abiertos: **2**
- P1 abiertos: **8**
