# Nexora One — Auditoría Forense v3 · M2.1 Plant & Propagation Engine

Estado: **VERIFIED — 10/10 hallazgos cerrados**  
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

## Matriz final de hallazgos

| ID | Sev. | Estado | Área | Cierre verificado |
|---|---:|---|---|---|
| M21-F001 | P0 | **Verified** | Genetics / tenancy | `GeneticProfile` es tenant-owned; create/update/archive pasan por `geneticProfileCommand`, permiso `manage_cultivation` y eventos canónicos. IDs/nombres repetidos quedan aislados por organización. |
| M21-F002 | P0 | **Verified** | Genetics / lifecycle | Se eliminó el borrado físico desde `GeneticsPage`; la genética se archiva preservando identidad, dependencias e historial. |
| M21-F003 | P1 | **Verified** | GeneticProfile | Perfil extensible con clasificación THC/CBD/mixta y parámetros agronómicos configurables, manteniendo compatibilidad con datos anteriores. |
| M21-F004 | P0 | **Verified** | Propagation / command boundary | La creación del corte salió de React. `propagationBatchCommand` publica intención durable antes del commit, exige permiso, usa `commandId` e IDs deterministas y es idempotente ante retry. |
| M21-F005 | P0 | **Verified** | Propagation / tenancy | Batch y cada Clone reciben `organizationId`; sede, banco, genética y fuente se validan bajo el tenant activo antes de cualquier side effect. |
| M21-F006 | P0 | **Verified** | Source identity | `propagationSourceUnits()` acepta `organizationId`; la fuente individual se resuelve por identidad tenant-scoped y falla cerrada ante IDs históricos repetidos. |
| M21-F007 | P0 | **Verified** | Promotion Engine | `propagationPromotionCommand` es tenant-aware, permission-aware e idempotente. Retry, selección ya promovida y carreras concurrentes fallan de forma determinista. Se corrigió además un P0 descubierto durante reauditoría: las claves internas de commit ahora usan `(organizationId,id)`, evitando contaminación cuando dos tenants comparten IDs históricos. |
| M21-F008 | P0 | **Verified** | Production positions | Promoción productiva ya no fabrica UUID/geometría. Reserva Positions canónicas `EMPTY` existentes, conserva sus IDs/fila/posición y aborta ante capacidad insuficiente o cambio concurrente. |
| M21-F009 | P1 | **Verified** | Action Engine | Se recuperó `src/core/actions` como autoridad central de registro/evaluación/autorización/ejecución. Las acciones vegetales delegan a los command boundaries certificados; React consume `PlantActions` y no conoce comandos concretos. |
| M21-F010 | P1 | **Verified** | Product architecture | Acción real probada extremo a extremo: Action Engine → command → Domain Event → Event Bus → Operational Ledger → Timeline → Passport → Knowledge Graph. Passport expone la acción contextual canónica y Graph conserva su evidencia sin convertirse en executor. |

## Evidencia técnica de cierre

### Genetics — F001/F002/F003

- `src/domain/geneticProfile.js` centraliza el contrato de perfil y ownership.
- `src/services/geneticProfileCommand.js` concentra create/update/archive y eventos.
- `src/pages/GeneticsPage.jsx` deja de mutar o borrar directamente la colección.
- pruebas adversariales: tenant duplicado, nombre duplicado por tenant, permiso denegado, retry, update, archive e identidad estable.
- **Quality #1686: Functional + Coverage + Production Build + Artifact Audit verdes.**

### Propagation creation — F004/F005/F006

- `src/services/propagationBatchCommand.js` hace preflight de tenant, sede, banco, fuente, genética, autorización excepcional y capacidad.
- el `commandId` determina batch y IDs individuales de Clone para evitar duplicados en retry.
- `PurposeAwarePropagationForm` dejó de fabricar batches/unidades y delega a la acción registrada.
- pruebas adversariales: mismo `plantId` entre empresas, banco extranjero, sobrecapacidad, genética inactiva/mismatch, permiso denegado y colisiones concurrentes.
- **Quality #1702: Functional + Coverage + Production Build + Artifact Audit verdes.**

### Promotion — F007/F008

- `src/services/propagationPromotionCommand.js` valida tenant, batch, Clone, nave, cama y capacidad antes del commit.
- identidad interna de commit se resuelve por clave compuesta `(organizationId,id)`.
- producción ocupa Positions canónicas preexistentes; no crea nueva geometría.
- mother/grandmother renewal usa destinos deterministas y tenant-owned.
- pruebas adversariales: IDs repetidos cross-tenant, retry, capacidad insuficiente, promoción concurrente, permission deny y destinos inválidos.
- **Quality #1716: Functional + Coverage + Production Build + Artifact Audit verdes.**

### Action Engine — F009

- `src/core/actions/actionEngine.js` aporta registry, target filtering, autorización, validación, aislamiento/inmutabilidad y ejecución central.
- `src/core/actions/plantActionIds.js` define IDs canónicos compartidos.
- `src/services/plantActionEngine.js` registra `plant.propagation.cut` y `propagation.batch.promote` y delega a comandos existentes.
- `PurposeAwarePropagationForm` y `RootedCuttingPromotionPanel` consumen Action Engine; no contienen autoridad exclusiva de negocio.
- **Quality #1738: Functional + Coverage + Production Build + Artifact Audit verdes.**

### Passport / Ledger / Timeline / Graph — F010

- Material Plant Passport deriva `plant.propagation.cut` cuando la planta está operativamente disponible; una planta bloqueada/retirada no expone esa acción por defecto.
- `passportGraphProjection` conserva action IDs como evidencia inmutable del nodo, sin ejecutar acciones desde Graph.
- prueba de integración ejecuta un corte real por Action Engine, publica mediante `publishDomainEvent`, atraviesa Event Bus y Operational Ledger, proyecta Timeline desde Ledger y termina proyectando Passport al Knowledge Graph.
- **Quality #1754: Functional + Coverage + Production Build + Artifact Audit verdes.**

## Reauditoría final

Se reauditaron explícitamente las invariantes de mayor riesgo:

1. **Tenant isolation:** IDs históricos iguales no cruzan organización en fuente, batches, Clones, Positions, Passport ni commit de promoción.
2. **Idempotencia:** retry del mismo `commandId` no crea batches, Clones, promociones ni destinos duplicados.
3. **Durable intent:** las mutaciones M2.1 publican `core.operation.requested` antes del commit y un evento final causalmente enlazado después.
4. **Physical authority:** banco y Position definen capacidad; Promotion no inventa geometría productiva.
5. **Genealogía:** cada Clone conserva parent/source individual y la promoción preserva el enlace hacia Position/destino.
6. **UI boundary:** las pantallas son consumidoras de Action Engine/commands y no autoridad de dominio.
7. **Shared engines:** Event Bus, Operational Ledger, Timeline, Passport y Knowledge Graph conservan sus autoridades previas; M2.1 no introduce singletons ni protocolos de idempotencia paralelos.
8. **No destructive lifecycle:** Genetics se archiva; no se borra físicamente identidad regulatoria/operativa.
9. **Cross-engine evidence:** la acción vegetal canónica permanece coherente en Action Engine, Passport y Graph.
10. **Quality gates:** ningún umbral fue reducido para obtener verde.

## Criterios de cierre

1. ✅ GeneticProfile tenant-owned, no destructivo y con contrato técnico extensible.
2. ✅ Corte de propagación ejecutado por comando/action central, permission-aware, tenant-aware e idempotente.
3. ✅ Fuente individual resuelta por `(organizationId, plantId)` y misma sede/tenant que banco/destino.
4. ✅ Batch y cada Clone/PropagationUnit con identidad/ownership canónicos.
5. ✅ Promotion Engine fail-closed, idempotente y con validación de destino/capacidad.
6. ✅ ProductionPlant/Position gestionados por autoridad física canónica, no por estructuras ad hoc.
7. ✅ Genealogía individual preservada y proyectable a Passport/Graph.
8. ✅ Action Engine central disponible para acciones vegetales reutilizables; páginas solo consumen acciones.
9. ✅ Eventos significativos pasan por Event Bus/Ledger/Timeline y evidencia se integra con Passport/Knowledge Graph.
10. ✅ Pruebas adversariales de tenancy, retry, capacidad, parent/genética y permisos.
11. ✅ Quality completo verde.
12. ✅ Reauditoría final sin P0/P1 abiertos dentro del alcance M2.1.

## Conteo final

- Verified: **10**
- Open: **0**
- P0 abiertos: **0**
- P1 abiertos: **0**

> Nota de seguridad de release: este documento certifica el alcance técnico de M2.1 sobre la rama `audit/v3-m2-1-plant-propagation`. El PR #43 permanece separado de `main` hasta completar el proceso de revisión/merge correspondiente.
