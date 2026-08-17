# Nexora One — Auditoría Forense v3 · M3.2 MIPE

Estado: **AUDIT IN PROGRESS — 4/12 Verified**  
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
| M32-F003 | P0 | **Verified** | Commands/permissions/events | 11 operaciones explícitas, permisos, replay, tenant guard y requested→commit→completion; seis superficies sin mutación MIPE directa. Quality #1983; cierre documental #1986. |
| M32-F004 | P0 | **Verified** | Treatment/inventory transaction | Ejecución remota atómica de lote+movimiento+tratamiento+hallazgo+costo, con locks/version preflight/idempotencia. Quality #2000. |
| M32-F005 | P1 | **Open** | Workflow/audit history | Estado/fecha todavía pueden reescribirse y existe hard-delete. Falta workflow canónico e historial append-only. |
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

- `src/services/mipeCommand.js` expone 11 operaciones explícitas; no acepta recipes arbitrarios.
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

Con dos dispositivos distintos y command IDs diferentes, ambos podían partir del mismo saldo/versiones locales y ejecutar `executeTreatment()` contra el mismo lote. El replay local de F003 no resuelve esa carrera porque cada dispositivo puede presentar una intención válida diferente antes de conocer la escritura del otro.

### Solución

- `src/domain/mipe.js` permite IDs deterministas para `inventoryMovement` y `costEntry`, y normaliza `siteId` en las consecuencias ejecutadas.
- `src/services/mipeTreatmentTransaction.js` construye una unidad atómica de **exactamente cinco consecuencias**:
  1. `inventoryLots`;
  2. `inventoryMovements`;
  3. `treatments`;
  4. `findings`;
  5. `costEntries`.
- El builder verifica organización/sede, identidades, producto/lote compartidos, Treatment=`Ejecutado`, Finding=`Seguimiento`, movimiento=`Consumo`/`MipeTreatment`, cantidad y cadena `balanceBefore + signedQuantity = balanceAfter`, saldo final no negativo y costo causal.
- Lote, Treatment y Finding llevan su `_syncVersion` previa; Movement y Cost nuevos deben iniciar en versión 0.
- `supabase/migrations/20260817010000_mipe_treatment_execution.sql` crea `mipe_treatment_executions` y RPC `commit_mipe_treatment_execution`.
- El RPC exige sesión, membresía activa, `execute_treatments`, ausencia de deny y alcance de sede.
- Un advisory lock serializa el mismo command; luego todas las filas de `erp_records` se bloquean y preflightan antes del primer write.
- El servidor exige que el Treatment remoto siga `Programado`, que lote/producto/sede no hayan cambiado y que el saldo remoto coincida con `balanceBefore`.
- Si cualquier versión cambió, el RPC lanza `MIPE_TREATMENT_VERSION_CONFLICT` y toda la unidad revierte.
- Un receipt remoto `(organization_id, command_id)` conserva firma, Treatment, sede y resultado. El mismo command recupera el resultado tras una respuesta perdida sin repetir consumo; reutilizar el ID con contenido distinto falla cerrado.
- `mipeCommand.js` usa `prepareCommit`: publica intención, ejecuta la precondición/transacción remota y solo después hidrata confirmación + receipt local y publica `mipe.treatment.executed`.
- La confirmación debe contener exactamente las cinco identidades esperadas, con empresa y versiones válidas; respuesta parcial, extranjera o duplicada se rechaza.
- La hidratación usa `sync:false` porque las cinco filas ya fueron escritas por el RPC y no deben reencolarse.
- `mipeCommandStore.js` activa la transacción remota solo si Supabase está configurado; instalaciones locales conservan el flujo histórico.
- Si la empresa activa cambia después del apply remoto pero antes de hidratar, no se modifica el tenant equivocado ni se publica completion; el receipt remoto permite recuperar luego con el mismo command.

### Pruebas adversariales

`tests/m3-2-mipe-inventory-concurrency.test.mjs` cubre nueve escenarios:

- conjunto exacto de cinco consecuencias, versiones base e IDs deterministas;
- dos dispositivos desde las mismas versiones: el primero gana y el segundo falla sin efectos;
- respuesta perdida y retry con el mismo command sin doble consumo/costo;
- cambio de tenant después del apply remoto;
- confirmación parcial, extranjera o duplicada;
- hidratación que preserva homónimos de otra empresa;
- contrato SQL de lock, permisos, `FOR UPDATE`, version preflight y write posterior;
- activación productiva del RPC solo con Supabase;
- contaminación del conjunto atómico rechazada fail-closed.

### Quality y reauditoría

- Delta desde el cierre F003 `acd135e...` hasta el HEAD funcional F004: **6 archivos**; no toca UI, workflow ni sync general.
- Commits principales: `3a8355edc1bcf911fc9420a1a6fc9b7db235206f`, `c5599520f0a426ea54f0d68bc5bd64b69f070452`, `c0ec9caa50ba013aebc775e37098321193111089`, `4f53c4f1d2a0f108c7f65cbd6a95646edc3444df`, `f52dbef28f530896cca6301983962ac342689480`, `f0e5ada09032fa7fcfb72d686ee264fd0f74eb79`.
- Quality #1997: rojo útil, **1013/1018**. Las cinco fallas provenían del fixture adversarial: Findings referenciaban `incident-a/incident-b`, pero la prueba había dejado `incidents: []`; la tenancy F002 falló cerrado correctamente antes de la transacción.
- Corrección exclusiva del fixture: `271503e48034461ce13c55b56620eda5dc6759e5`; no cambió código productivo entre #1997 y #2000.
- Quality #2000: **verde, 1018/1018 pruebas**, cero fallos; static audit, dependency audit, environment contract, authentication/session audit, coverage gate, production build y production artifact audit verdes.
- Reauditoría: dos command IDs distintos con las mismas versiones remotas no pueden consumir el mismo saldo; el perdedor no produce Movement, Cost, cambio de Treatment/Finding ni completion event.
- F004 no se atribuye workflow/hard-delete (F005), persistencia/sync general (F008) ni autoridad de restricciones (F009).

## Orden de cierre

1. **F001 Domain authority — Verified.**
2. **F002 Tenancy — Verified.**
3. **F003 Commands/permissions/events — Verified.**
4. **F004 Treatment/inventory transaction — Verified.**
5. **F005 Workflow/history** — transición canónica, falso positivo, resolución, corrección e historial append-only.
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

- Verified: **4**
- Open: **8**
- P0 abiertos: **0**
- P1 abiertos: **8**
