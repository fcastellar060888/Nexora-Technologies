# Nexora One — Auditoría Forense v3 · M1.1 Core Operations

Estado: **RE-AUDIT — 10/10 hallazgos verificados, cierre pendiente**
Base: cierre M0 certificado en PR #40
Método: Audit → Fix → Test → Quality Gate → Re-Audit → Close

## Alcance

Núcleo operativo: Organization → Site → Facility → Position → PlantIdentity, tenancy, permisos, mutaciones y trazabilidad.

## Hallazgos reproducibles

| ID | Sev. | Estado | Hallazgo | Evidencia de corrección |
|---|---|---|---|---|
| M11-F001 | P0 | Verified | Facility no llevaba ownership canónico. | `facilityEngine` proyecta ownership organizacional explícito y falla ante estructura sin tenant demostrable. Quality #1508 verde en rerun. |
| M11-F002 | P0 | Verified | Position carecía de org/site/parent/occupancy canónicos. | Position exige ownership y ubicación canónica preservando IDs históricos. Quality #1508 verde en rerun. |
| M11-F003 | P0 | Verified | Material Plant Identity no conservaba `organizationId`. | Materialización durable tenant-owned + migración legacy determinista. Quality #1508 verde en rerun. |
| M11-F004 | P0 | Verified | El payload de dominio podía entrar al sync sin ownership canónico. | Upsert canonicaliza `_organizationId`; cross-tenant se rechaza antes de persistir; hidratación usa tenant remoto autoritativo. Quality #1512 verde. |
| M11-F005 | P1 | Verified | Escrituras de planta evitaban un Command boundary uniforme. | Registro de eventos de planta pasa por command boundary con tenant, precondiciones, `commandId`, idempotencia y eventos requested/completed. Quality #1524 verde. |
| M11-F006 | P1 | Verified | `PlantProfilePage` escribía sin permiso específico. | Lectura del Passport permanece separada; escritura exige `record_observations` en el command boundary. Quality #1524 verde. |
| M11-F007 | P1 | Verified | `local-installation` podía adoptar silenciosamente una identidad huérfana en multiempresa. | Ownership sintético solo se admite en estado realmente standalone; un registro huérfano con varias empresas falla cerrado. Quality #1552 verde en rerun. |
| M11-F008 | P1 | Verified | Passport podía inferir/fabricar ownership ambiguo. | Resolver canónico por tenant y estructura; ownership ambiguo o contradictorio falla cerrado. Quality #1552 verde en rerun. |
| M11-F009 | P2 | Verified | Fachada virtual y materialización durable podían representar dos identidades del mismo individuo. | La fachada legacy apunta a la identidad durable cuando existe y conserva `legacyId`; registry tenant-scoped. Quality #1552 verde en rerun. |
| M11-F010 | P0 | Verified | IDs históricos iguales podían resolverse globalmente sin `(organizationId,id)`. | Plant/Material Passport, registry y selección resuelven por tenant; pruebas cubren IDs iguales entre empresas y evidencia secundaria cross-tenant. Quality #1552 verde en rerun. |

## Evidencia de Quality

- Quality #1508 (rerun): P0 Facility / Position / MaterialPlantIdentity — verde completo.
- Quality #1512: frontera de persistencia/sync tenant-owned — verde completo.
- Quality #1524: Command boundary + permisos de escritura — verde completo.
- Quality #1552 (rerun, mismo commit): **718 Functional + Coverage + Production Build + Production Artifact Audit — verde completo**.
- Dos ejecuciones previas mostraron el mismo test histórico de timeout del Event Bus como flake de timing; el rerun del mismo commit pasó sin cambios de código. No se modificó M0 para maquillar ese comportamiento.

## Invariantes demostradas

1. Toda entidad M1.1 materializada tiene ownership organizacional demostrable o falla cerrada.
2. `local-installation` no puede apropiarse de un registro huérfano cuando el estado contiene múltiples empresas.
3. Position es tenant-owned/site-owned y declara parent y ocupación.
4. Identidad vegetal durable conserva IDs históricos, pero su unicidad/resolución es `(organizationId,id)`.
5. La fachada virtual de material vegetal converge a la identidad durable cuando existe.
6. Escrituras nuevas de eventos de planta requieren permiso, tenant y `commandId` y dejan evidencia requested/completed.
7. Payloads sincronizados llevan ownership canónico y se rechazan antes de persistir si contradicen el tenant activo.
8. Passport no mezcla relaciones, MIPE, documentos ni Timeline de otra empresa aun con IDs históricos iguales.

## Criterios de cierre

1. Toda entidad M1.1 materializada debe tener ownership organizacional demostrable y estable. **Verificado.**
2. Ninguna creación/lectura sensible puede usar un tenant sintético como fallback en modo multiempresa. **Verificado.**
3. Position debe ser entidad canónica tenant-owned y site-owned, con parent y ocupación explícitos. **Verificado.**
4. PlantIdentity debe tener una sola autoridad durable y compatibilidad legacy determinista. **Verificado.**
5. Mutaciones M1.1 deben pasar por boundary de comando con tenant, autorización, validación, idempotencia y evento/auditoría. **Verificado para la escritura de eventos de planta; reauditoría buscará rutas residuales.**
6. Pruebas adversariales cross-tenant, identidad duplicada, parent inválido y escritura sin permiso. **Verificado.**
7. Quality completo verde. **Verificado en #1552 rerun.**
8. Reauditoría independiente antes de Closed. **En curso.**
