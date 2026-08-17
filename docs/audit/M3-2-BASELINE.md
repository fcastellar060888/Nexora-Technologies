# Nexora One — Auditoría Forense v3 · M3.2 MIPE

Estado: **AUDIT OPEN — 0/12 Verified**  
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
- `src/pages/FindingsPage.jsx` consume `state.findings`, `state.incidents` y `state.houses` globales; editar, cerrar y borrar usan `useStore().update()` y comparan exclusivamente por `id`.
- `FindingsPage` permite seleccionar directamente cualquier `findingStatuses`, modificar la fecha original y eliminar físicamente un hallazgo; no existe historial append-only de transición/corrección en esa frontera.
- `src/pages/TreatmentsPage.jsx` consume hallazgos/productos/lotes globales y llama directamente `scheduleTreatment()` / `executeTreatment()` dentro de `useStore().update()`.
- `src/domain/materialPlantMipe.js` contiene reglas valiosas para bloqueo, intervención y resolución, pero `findings` y `mipeInterventions` se resuelven por `id` simple y los registros creados no fijan ownership de empresa.
- `mipeInterventions` no forma parte de la autoridad de persistencia/sync certificada en M3.1; los seguimientos de material vegetal pueden existir localmente sin una identidad remota canónica equivalente.
- Los permisos `manage_mipe` y `execute_treatments` existen en el sistema, pero las mutaciones anteriores no pasan por un command boundary MIPE que los revalide en el momento del commit.
- La caché segmentada histórica acepta registros sin ownership en la partición activa; mientras MIPE produzca registros sin empresa inequívoca, la separación local no constituye una garantía de tenancy.
- `tests/mipe.test.mjs` cubre matemática de dosis, ejecución local, consumo, costo, reentrada/carencia e inventario insuficiente. No cubre IDs repetidos entre empresas, permisos, replay, cambio de tenant, carrera remota ni Graph.

## Hallazgos iniciales

| ID | Sev. | Estado | Área | Hallazgo |
|---|---:|---|---|---|
| M32-F001 | P0 | **Open** | Domain authority | `Finding`, `Incident`, `Treatment` e `Intervention` no tienen una autoridad canónica tenant-owned e inmutable. La resolución por ID global permite identidad ambigua entre empresas. |
| M32-F002 | P0 | **Open** | Tenancy | Lectura, filtros, edición, cierre, eliminación, programación y ejecución operan sobre colecciones globales; los registros MIPE legacy carecen de ownership consistente y pueden entrar en la partición equivocada. |
| M32-F003 | P0 | **Open** | Commands/permissions/events | Las mutaciones MIPE usan `useStore().update()` directo. `manage_mipe` / `execute_treatments` no se revalidan en un command boundary; no hay idempotencia, causalidad ni completion events canónicos. |
| M32-F004 | P0 | **Open** | Treatment/inventory transaction | Ejecutar un tratamiento consume lote, crea movimiento/costo y cambia estados localmente, sin precondición/transacción remota multi-dispositivo. Dos dispositivos pueden competir sobre el mismo stock. |
| M32-F005 | P1 | **Open** | Workflow/audit history | Un hallazgo puede editar fecha/estado arbitrariamente, cerrarse sin workflow y borrarse físicamente. No existe transición canónica ni historial append-only suficiente para auditoría agronómica. |
| M32-F006 | P1 | **Open** | Follow-up/interventions | Seguimientos/intervenciones de material vegetal usan `mipeInterventions` sin identidad/ownership remoto certificado; la causalidad intervención → hallazgo → resolución no está unificada con MIPE productivo. |
| M32-F007 | P1 | **Open** | Incident/product authority | Incidencias y productos MIPE se consumen como catálogos globales; dosis, unidad, plaga/objetivo, restricciones y vigencia requieren referencias tenant-aware y snapshots ejecutables. |
| M32-F008 | P1 | **Open** | Persistence/sync | `findings/incidents/treatments` legacy y `mipeInterventions` no forman una colección canónica completa con schema, migration, cache, bootstrap, sync y tombstones por `(organizationId,id)`. |
| M32-F009 | P1 | **Open** | Operational restrictions | Reentrada, carencia y bloqueo/liberación de material vegetal existen como reglas parciales, pero no como restricciones tenant-aware proyectables y verificables desde una autoridad común. |
| M32-F010 | P1 | **Open** | Dashboard/croquis/context | Dashboard, hallazgos y tratamientos no consumen una vista MIPE scoped por Empresa → Sede → Nave → Cama → Planta; los conteos y selecciones pueden mezclar contexto global. |
| M32-F011 | P1 | **Open** | Passport/Knowledge Graph | Passport/Graph muestran MIPE legacy de forma parcial, pero no explican de extremo a extremo Finding → Incident → Intervention/Treatment → Product/Lot → Restriction/Resolution con tenancy canónica. |
| M32-F012 | P1 | **Open** | Adversarial verification | Falta una suite que fuerce IDs homónimos, referencia extranjera, cambio de tenant, replay, doble ejecución, carrera de stock, hard-delete, persistencia/sync y proyección Graph sin fuga. |

## Orden de cierre

1. **F001 Domain authority** — crear identidad y contratos canónicos tenant-owned sin tocar UI primero.
2. **F002 Tenancy** — scope/merge/migration fail-closed para todo MIPE.
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
