# Nexora One — Auditoría Forense v3 · M2.1 Plant & Propagation Engine

Estado: **BASELINE — auditoría abierta**
Base certificada: M1.2 Core Shared Services & Governance, head `1a01e95a6e22d3f655450df44d95890ed0b39672`, Quality #1669 verde.
Normativa: `docs/NEXORA_DOMAIN_MODEL_V1.md` + `docs/NEXORA_PRODUCT_DOCTRINE.md`.
Método: Audit → Fix → Test → Quality Gate → Re-Audit → Close.

## Alcance

M2.1 audita y sanea la autoridad vegetal antes de entrar a Growing Medium, MIRFE o MIPE:

- GeneticProfile;
- PlantIdentity individual;
- Grandmother / Mother / Clone / ProductionPlant;
- PropagationBatch y propósito;
- Promotion Engine;
- genealogía individual;
- Action Engine;
- integración con Passport, Ledger, Timeline y Knowledge Graph;
- tenancy, permisos, idempotencia y capacidad física.

## Hallazgos iniciales reproducibles

| ID | Sev. | Estado | Área | Hallazgo |
|---|---:|---|---|---|
| M21-F001 | P0 | Open | Genetics / tenancy | `GeneticsPage` crea/edita `state.genetics` directamente, sin `organizationId`, command boundary ni evento canónico. La misma colección puede contener IDs/nombres de varias empresas sin autoridad scoped. |
| M21-F002 | P0 | Open | Genetics / lifecycle | `GeneticsPage` elimina físicamente una genética con `filter()` y solo comprueba `plantPositions`. No protege dependencias en abuelas, madres, propagación, genealogía, documentos ni historia. |
| M21-F003 | P1 | Open | GeneticProfile | El perfil actual visible se reduce esencialmente a `name + color`; no materializa la clasificación regulatoria/comercial (THC/CBD/mixta) ni parámetros agronómicos configurables exigidos por el modelo canónico. |
| M21-F004 | P0 | Open | Propagation / command boundary | `PurposeAwarePropagationForm` crea batches, unidades y lotEvents mediante `update()` directo. No existe intención durable, idempotencia, permiso de comando ni Domain Event canónico para el corte de esquejes. |
| M21-F005 | P0 | Open | Propagation / tenancy | Los nuevos `PropagationBatch` y `PropagationUnit` no reciben `organizationId` canónico. La selección de sede/banco/fuente se basa principalmente en IDs y `siteId`, por lo que no demuestra aislamiento cuando IDs históricos se repiten entre tenants. |
| M21-F006 | P0 | Open | Source identity | `propagationSourceUnits()` filtra por `siteId` pero no por organización. Una fuente elegible debe demostrar `(organizationId, plantId)` y que la sede/banco pertenecen al mismo tenant antes de cortar. |
| M21-F007 | P0 | Open | Promotion Engine | `promotePropagationUnits()` busca batch/cama por ID global, no exige tenant/contexto, no tiene `commandId` ni deduplicación y puede repetir una promoción por retry o contexto incorrecto. |
| M21-F008 | P0 | Open | Production positions | La promoción a producción crea `plantPositions` manualmente con UUID, `bedId/row/position` y campos parciales; salta el constructor canónico de Position certificado en M1.1, no materializa ownership/site/parent/occupancy de forma contractual y no demuestra capacidad física antes del commit. |
| M21-F009 | P1 | Open | Action Engine | La rama certificada no contiene `src/core/actions`. La doctrina exige acciones registradas centralmente y el trabajo previo quedó aislado en PR #39; M2.1 necesita una autoridad Action Engine integrada sobre la base saneada, no lógica de acción en páginas. |
| M21-F010 | P1 | Open | Product architecture | La creación de cortes y la promoción todavía dependen de componentes/páginas para decisiones exclusivas. Esto viola la regla normativa de que las pantallas sean consumidores y que cada nuevo motor publique eventos e integre Ledger/Timeline/Passport/Knowledge Graph. |

## Evidencia de baseline

### Genetics

`src/pages/GeneticsPage.jsx`:
- `update()` directo para create/edit;
- `filter()` destructivo para delete;
- guard limitado a `plantPositions`;
- entidad nueva: `{id, active, name, color}`;
- sin ownership organizacional canónico.

### Propagation creation

`src/components/PurposeAwarePropagationForm.jsx`:
- genera batch y unidades dentro de React;
- calcula código/secuencia en UI;
- selecciona banco y fuente por IDs/site;
- muta `propagationBatches`, `propagationUnits` y `lotEvents` directamente;
- no publica Domain Event.

`src/domain/propagationPurpose.js`:
- `propagationSourceUnits()` recibe `siteId` pero no `organizationId`;
- `createPurposeAwareBatch()` conserva source IDs/propósito, pero no impone ownership tenant.

### Promotion

`src/domain/propagationPromotion.js`:
- `batch = propagationBatches.find(id)`;
- `bed = beds.find(id)`;
- promoción sin command/event boundary ni idempotency key;
- producción fabrica posiciones fuera de `createProductionPositions()`;
- mother/grandmother/production se actualizan en una única función de transformación sin autoridad Action Engine.

### Arquitectura

`src/core/` contiene audit, events, knowledgeGraph, ledger, passport, projectionEngine, selection y timeline, pero no `actions` en la línea certificada actual.

## Criterios de cierre

1. GeneticProfile tenant-owned, no destructivo y con contrato técnico extensible.
2. Corte de propagación ejecutado por comando/action central, permission-aware, tenant-aware e idempotente.
3. Fuente individual resuelta por `(organizationId, plantId)` y misma sede/tenant que banco/destino.
4. Batch y cada Clone/PropagationUnit con identidad/ownership canónicos.
5. Promotion Engine fail-closed, idempotente y con validación de destino/capacidad.
6. ProductionPlant/Position creados por autoridad canónica, no por estructuras ad hoc.
7. Genealogía individual preservada `Genetic → Grandmother → Mother → Clone → ProductionPlant` y proyectable a Passport/Graph.
8. Action Engine central disponible para acciones vegetales reutilizables; páginas solo consumen acciones.
9. Eventos significativos pasan por Event Bus/Ledger/Timeline y relaciones se integran con Knowledge Graph.
10. Pruebas adversariales: cross-tenant IDs repetidos, retry de promoción, capacidad insuficiente, parent inválido, genética archivada y permiso denegado.
11. Quality completo verde.
12. Reauditoría independiente sin P0/P1 abiertos.

## Conteo inicial

- Open: **10**
- P0: **7**
- P1: **3**
- Closed: **0**
