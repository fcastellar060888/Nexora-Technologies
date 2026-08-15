# Nexora One — Auditoría Forense v3 · M1.1 Core Operations

Estado: **CLOSED — 13/13 hallazgos verificados**
Base: cierre M0 certificado en PR #40
Método: Audit → Fix → Test → Quality Gate → Re-Audit → Close

## Alcance

Núcleo operativo: Organization → Site → Facility → Position → PlantIdentity, tenancy, permisos, mutaciones y trazabilidad.

## Hallazgos reproducibles

| ID | Sev. | Estado | Hallazgo | Evidencia de corrección |
|---|---|---|---|---|
| M11-F001 | P0 | Closed | Facility no llevaba ownership canónico. | `facilityEngine` proyecta ownership organizacional explícito y falla ante estructura sin tenant demostrable. Quality #1508 verde en rerun. |
| M11-F002 | P0 | Closed | Position carecía de org/site/parent/occupancy canónicos. | Position exige ownership y ubicación canónica preservando IDs históricos. Quality #1508 verde en rerun. |
| M11-F003 | P0 | Closed | Material Plant Identity no conservaba `organizationId`. | Materialización durable tenant-owned + migración legacy determinista. Quality #1508 verde en rerun. |
| M11-F004 | P0 | Closed | El payload de dominio podía entrar al sync sin ownership canónico. | Upsert canonicaliza `_organizationId`; cross-tenant se rechaza antes de persistir; hidratación usa tenant remoto autoritativo. Quality #1512 verde. |
| M11-F005 | P1 | Closed | Escrituras de planta evitaban un Command boundary uniforme. | Registro de eventos de planta pasa por command boundary con tenant, precondiciones, `commandId`, idempotencia y eventos requested/completed. Quality #1524 verde. |
| M11-F006 | P1 | Closed | `PlantProfilePage` escribía sin permiso específico. | Lectura del Passport permanece separada; escritura exige `record_observations` en el command boundary. Quality #1524 verde. |
| M11-F007 | P1 | Closed | `local-installation` podía adoptar silenciosamente una identidad huérfana en multiempresa. | Ownership sintético solo se admite en estado realmente standalone; un registro huérfano con varias empresas falla cerrado. Quality #1552 verde en rerun. |
| M11-F008 | P1 | Closed | Passport podía inferir/fabricar ownership ambiguo. | Resolver canónico por tenant y estructura; ownership ambiguo o contradictorio falla cerrado. Quality #1552 verde en rerun. |
| M11-F009 | P2 | Closed | Fachada virtual y materialización durable podían representar dos identidades del mismo individuo. | La fachada legacy apunta a la identidad durable cuando existe y conserva `legacyId`; registry tenant-scoped. Quality #1552 verde en rerun. |
| M11-F010 | P0 | Closed | IDs históricos iguales podían resolverse globalmente sin `(organizationId,id)`. | Plant/Material Passport, registry y selección resuelven por tenant; pruebas cubren IDs iguales entre empresas y evidencia secundaria cross-tenant. Quality #1552 verde en rerun. |
| M11-F011 | P0 | Closed | El Passport productivo podía mezclar evidencia secundaria de otra empresa cuando IDs históricos colisionaban. | Genealogía, documentos, MIPE, tratamientos, eventos, genética, incidentes y productos quedan gobernados por el tenant de la planta; evidencia sin ownership demostrable se excluye en multiempresa. Quality #1558 verde completo. |
| M11-F012 | P0 | Closed | Empresa, Sede e Infraestructura mutaban el Store antes de confirmar una intención durable, permitiendo cambios sin evidencia canónica si fallaba la publicación. | `core.operation.requested` + `executeCoreOperationCommand`: intención durable → commit idempotente → evento final correlacionado. Company, Site, Area, House, Bed y PropagationBank usan el boundary; rutas de configuración exigen `manage_settings`. Quality #1586 y reauditoría #1590 verdes. |
| M11-F013 | P0 | Closed | `BedManager` seguía creando posiciones con el generador legacy sin ownership/site/parent/occupancy canónicos. | La ruta productiva usa `createProductionPositions()` y conserva operación Activa/Vacía, genética y contenedor mientras añade ownership, site, parent y occupancy canónicos. Quality #1578 verde completo. |

## Evidencia de Quality

- Quality #1508 (rerun): P0 Facility / Position / MaterialPlantIdentity — verde completo.
- Quality #1512: frontera de persistencia/sync tenant-owned — verde completo.
- Quality #1524: Command boundary + permisos de escritura de planta — verde completo.
- Quality #1552 (rerun, mismo commit): 718 Functional + Coverage + Production Build + Production Artifact Audit — verde completo.
- Quality #1558: aislamiento tenant de evidencia secundaria del Cultivation Passport — verde completo.
- Quality #1572: `coreOperationCommand` + Company/Site — verde completo.
- Quality #1578: creación canónica de cama/posiciones — verde completo.
- Quality #1586: migración completa Area/House/Bed/Bank al command boundary — 722 Functional + Coverage + Production Build + Production Artifact Audit — verde completo.
- Quality #1590: reauditoría transversal final del command boundary, autorización de rutas y boundary permission-aware de Plant Profile — verde completo.
- Ejecuciones previas mostraron un test histórico de timeout del Event Bus como flake de timing; reruns del mismo código confirmaron el comportamiento sin modificar M0 para ocultarlo.

## Invariantes demostradas

1. Toda entidad M1.1 materializada tiene ownership organizacional demostrable o falla cerrada.
2. `local-installation` no puede apropiarse de un registro huérfano cuando el estado contiene múltiples empresas.
3. Position es tenant-owned/site-owned y declara parent y ocupación; las posiciones nuevas nacen desde el constructor canónico usado por la UI productiva.
4. Identidad vegetal durable conserva IDs históricos, pero su unicidad/resolución es `(organizationId,id)`.
5. La fachada virtual de material vegetal converge a la identidad durable cuando existe.
6. Escrituras de planta requieren permiso, tenant y `commandId` y dejan evidencia requested/completed.
7. Company, Site, FacilityArea, House, Bed y PropagationBank no mutan directamente el Store: pasan por intención durable, commit y evento final canónico.
8. Las rutas de configuración de Company/Site/Facility están protegidas por `manage_settings`; Plant Profile aplica `record_observations` dentro de su command boundary.
9. Payloads sincronizados llevan ownership canónico y se rechazan antes de persistir si contradicen el tenant activo.
10. Passport no mezcla relaciones, genealogía, MIPE, tratamientos, documentos ni Timeline de otra empresa aun con IDs históricos iguales.
11. Archivados de Area/House/Bed/Bank conservan identidad e historial y mantienen sus guards de dependencias activas.

## Criterios de cierre

1. Toda entidad M1.1 materializada debe tener ownership organizacional demostrable y estable. **Verificado.**
2. Ninguna creación/lectura sensible puede usar un tenant sintético como fallback en modo multiempresa. **Verificado.**
3. Position debe ser entidad canónica tenant-owned y site-owned, con parent y ocupación explícitos, incluida la ruta productiva de creación. **Verificado.**
4. PlantIdentity debe tener una sola autoridad durable y compatibilidad legacy determinista. **Verificado.**
5. Mutaciones M1.1 deben pasar por boundary de comando con tenant, autorización, validación, idempotencia y evento/auditoría. **Verificado.**
6. Pruebas adversariales cross-tenant, identidad duplicada, evidencia secundaria colisionada, parent inválido y escritura sin permiso. **Verificado.**
7. Quality completo verde. **Verificado hasta #1590.**
8. Reauditoría independiente antes de Closed. **Completada: no quedaron rutas de mutación directa reproducibles dentro del alcance M1.1.**
