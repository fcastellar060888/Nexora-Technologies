# Nexora One — Auditoría Forense v3 · M1.1 Core Operations

Estado: **OPEN — baseline inicial**
Base: cierre M0 certificado en PR #40
Método: Audit → Fix → Test → Quality Gate → Re-Audit → Close

## Alcance

Núcleo operativo: Organization → Site → Facility → Position → PlantIdentity, tenancy, permisos, mutaciones y trazabilidad.

## Hallazgos reproducibles

| ID | Sev. | Estado | Hallazgo |
|---|---|---|---|
| M11-F001 | P0 | Open | `facilityGraphFromState()` proyecta SITE/AREA/HOUSE/ZONE/BED/BANK/TRAY sin `organizationId` canónico. La pertenencia al tenant queda implícita por joins y no forma parte del contrato de cada nodo. |
| M11-F002 | P0 | Open | `createProductionPositions()` crea posiciones con `bedId/row/position` pero sin `organizationId`, `siteId`, parent canónico ni estado de ocupación. El identificador `${bedId}-F#-P#` tampoco incorpora explícitamente tenant. |
| M11-F003 | P0 | Open | `materialPlantIdentity` materializa abuelas/madres sin `organizationId`; la identidad durable de la unidad no conserva ownership explícito aunque el Passport posterior pueda inferirlo desde el lote. |
| M11-F004 | P0 | Open | El store genérico genera `collectionChanges()` sobre payloads que no están obligados a contener tenant. La cola sí añade `companyId`, pero el registro de dominio puede permanecer sin ownership canónico; M1.1 no debe depender solo del envelope de sincronización. |
| M11-F005 | P1 | Open | Mutaciones operativas relevantes siguen ejecutándose directamente mediante `update()` en páginas (ej. eventos de planta/activos), sin un Command boundary M1.1 uniforme que valide tenant, permisos, precondiciones e idempotencia antes de mutar. |
| M11-F006 | P1 | Open | `PlantProfilePage` permite agregar eventos operativos con `update()` sin guard de permiso específico en la ruta `/plant/:plantId`; `ProtectedRoute` autentica, pero esa ruta no declara permiso de escritura. |
| M11-F007 | P1 | Open | `expandPlantLot()` conserva un fallback `organizationId='local-installation'`. En una instalación multiempresa, una identidad sin ownership explícito no debe convertirse silenciosamente en un tenant sintético. |
| M11-F008 | P1 | Open | `cultivationPlantPassport` deriva `organizationId` mediante Site → company o campos legacy y cae también en `local-installation`; la creación de Passport debe fallar cerrada si no puede demostrar ownership organizacional. |
| M11-F009 | P2 | Open | Existen dos representaciones de identidad vegetal (materialización durable `materialPlantIdentity` y compatibilidad virtual `core/passport/plantIdentity`) con esquemas de ID diferentes. Debe existir una autoridad/canonicalización explícita para evitar identidades dobles del mismo individuo. |

## Evidencia de baseline

- `src/domain/facilityEngine.js`: nodos y posiciones sin ownership organizacional explícito.
- `src/domain/materialPlantIdentity.js`: unidades materializadas sin `organizationId`.
- `src/core/passport/plantIdentity.js`: ownership inferido desde lote y fallback `local-installation`.
- `src/core/passport/cultivationPlantPassport.js`: ownership inferido y fallback sintético.
- `src/services/store.jsx` + `src/services/syncEngine.js`: el envelope de sync contiene `companyId`, pero no convierte el payload de dominio en tenant-owned.
- `src/pages/PlantProfilePage.jsx`: escritura directa de `plantEvents`.
- `src/components/ProtectedRoute.jsx` + `src/App.jsx`: autenticación general, pero ruta de Passport de planta sin permiso de escritura específico.

## Criterios de cierre

1. Toda entidad M1.1 materializada debe tener ownership organizacional demostrable y estable.
2. Ninguna creación/lectura sensible puede usar un tenant sintético como fallback en modo multiempresa.
3. Position debe ser entidad canónica tenant-owned y site-owned, con parent y ocupación explícitos.
4. PlantIdentity debe tener una sola autoridad durable y compatibilidad legacy determinista.
5. Mutaciones M1.1 deben pasar por un boundary de comando con tenant, autorización, validación, idempotencia y evento/auditoría.
6. Pruebas adversariales cross-tenant, identidad duplicada, parent inválido y escritura sin permiso.
7. `npm run check` completamente verde.
8. Reauditoría independiente antes de Closed.
