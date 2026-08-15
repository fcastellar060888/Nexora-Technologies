# M1.1 — Core Operations Functional Specification

**Producto:** Nexora One  
**Milestone:** M1 — Core Platform Ready / inicio funcional  
**Bloque:** M1.1 — Núcleo Operativo  
**Arquitectura de referencia:** AH-001 v1.0  
**Estado:** Baseline funcional para implementación incremental

## 1. Propósito

Definir el núcleo operativo común que permite representar de forma estable la estructura empresarial, espacial y vegetal de Nexora One sin convertir pantallas o tablas en nuevos dominios. Este bloque debe producir una jerarquía física navegable y una identidad vegetal persistente que puedan reutilizar Production, MIPE, MIRFE, Inventory, Quality, Maintenance, Digital Twin y analítica.

## 2. Principios no negociables

1. Organization & MDM es propietario de empresa, sede y contexto organizacional.
2. Facility es propietario de espacios físicos, zonas, camas, bancos, bandejas y posiciones.
3. Genetics es propietario de identidad genética y lineage de cultivar.
4. Propagation es propietario de abuelas, madres, esquejes, bandejas, rooting y genealogía de propagación.
5. Production es propietario de planta operacional, ciclo, fase, ubicación, lote de cultivo y cosecha.
6. Una pantalla nunca se convierte por sí sola en System of Record.
7. IDs de negocio son estables; edición no puede reemplazar identidad.
8. No se elimina destructivamente una entidad con historia; se archiva o retira con trazabilidad.
9. Todo cambio crítico debe producir evento de dominio auditable.
10. El Store/UI no es autoridad canónica; consume estado oficial y proyecciones.
11. Toda entidad pertenece a una organización y, cuando aplique, a una sede.
12. No se admiten relaciones cross-tenant.

## 3. Jerarquía espacial canónica

La jerarquía funcional objetivo es:

`Organization → Site → FacilitySpace/House → SpaceZone → Bed/Bank → Tray/Row → Position → Container/Plant`

Compatibilidad operativa visible:

`Empresa → Sede → Nave/Área → Cama/Banco → Posición → Planta/Activo`

### Reglas

- Site nunca depende de una pantalla o módulo agrícola.
- House es una especialización operativa de FacilitySpace compatible con el modelo existente.
- Zone es opcional entre House y Bed/Bank.
- Bed y Bank son hermanos semánticos: producción y propagación respectivamente.
- Tray pertenece a Bank.
- Position identifica una ubicación física estable dentro de Bed/Tray cuando exista granularidad individual.
- ContainerProfile describe el contenedor y no la identidad de la planta.
- Una planta puede cambiar de Position sin cambiar de PlantIdentity.

## 4. Entidades mínimas M1.1

### Organization

Campos mínimos:
- id
- legalName / name
- status
- timezone
- locale
- defaultCurrency
- createdAt
- updatedAt

### Site

Campos mínimos:
- id
- organizationId
- name
- code
- address / geolocation cuando aplique
- timezone
- active
- createdAt
- updatedAt

### FacilitySpace / House

Campos mínimos:
- id
- organizationId
- siteId
- parentAreaId opcional
- name
- code
- type
- purpose
- dimensions + unit
- active

### SpaceZone

Campos mínimos:
- id
- organizationId
- siteId
- houseId
- name
- purpose
- capacity opcional
- dimensions
- active

### Bed

Campos mínimos:
- id
- organizationId
- siteId
- houseId
- zoneId opcional
- name
- rows
- plantsPerRow
- containerProfileId
- dimensions
- active

### Bank

Campos mínimos:
- id
- organizationId
- siteId
- zoneId opcional
- name
- dimensions
- trays
- active

### Tray

Campos mínimos:
- id
- bankId
- label
- quantity
- cellsPerTray
- growingMediumId
- usesPlug
- plugType
- active

### Position

Campos mínimos:
- id estable
- organizationId
- siteId
- parentType
- parentId
- row / index cuando aplique
- containerProfileId
- occupancyState
- active

### GeneticProfile

Campos mínimos:
- id
- organizationId
- name
- code
- classification
- lineage
- regulatory/commercial attributes configurables
- active

### PlantIdentity

Campos mínimos:
- id estable
- organizationId
- siteId
- geneticId
- plantType
- parentPlantId opcional
- sourcePropagationBatchId opcional
- currentLocationRef
- lifecycleStatus
- healthStatus
- createdAt
- retiredAt opcional

## 5. Invariantes

### Organización y tenancy

- Toda entidad M1.1 debe poseer organizationId explícito o heredado de una raíz validada.
- Ningún hijo puede referenciar un padre de otra organización.
- Ninguna consulta operativa puede mezclar tenants por defecto.

### Facility

- Site debe existir antes de crear cualquier espacio dependiente.
- Bed/Bank debe pertenecer a un Site válido a través de su jerarquía.
- Position no puede pertenecer simultáneamente a dos padres físicos.
- La capacidad calculada nunca puede ser negativa.
- Cambiar dimensiones no puede cambiar el ID de la entidad.

### Plant

- PlantIdentity no cambia cuando la planta se mueve.
- parentPlantId no puede apuntar a otra organización.
- La genealogía debe ser acíclica.
- Un retiro/archivo conserva historia.
- Lotes agrupan plantas; no sustituyen identidad individual cuando ésta ya existe.

## 6. Commands M1.1

### Organization / Site
- CreateOrganization
- UpdateOrganization
- ArchiveOrganization
- CreateSite
- UpdateSite
- ArchiveSite

### Facility
- CreateFacilitySpace
- UpdateFacilitySpace
- ArchiveFacilitySpace
- CreateZone
- UpdateZone
- ArchiveZone
- CreateBed
- UpdateBed
- ArchiveBed
- CreateBank
- UpdateBank
- ArchiveBank
- ConfigureTray
- CreatePositions
- ActivatePosition
- DeactivatePosition

### Plant
- CreatePlantIdentity
- MaterializePlantUnits
- AssignPlantToPosition
- MovePlant
- ChangePlantLifecycle
- RetirePlant
- LinkParentPlant

## 7. Eventos canónicos requeridos

Eventos ya alineados con el registry actual:
- facility.space.created
- facility.space.updated
- plant.identity.created
- plant.lifecycle.changed
- plant.relationship.created
- propagation.batch.created
- propagation.unit.promoted

Eventos adicionales M1.1 a admitir mediante evolución controlada del catálogo:
- organization.created
- organization.updated
- site.created
- site.updated
- facility.space.archived
- facility.position.created
- facility.position.activated
- facility.position.deactivated
- plant.location.assigned
- plant.location.changed
- plant.identity.retired

Todos deben incluir eventId, organizationId, actorId, occurredAt y aggregate estable conforme al contrato Foundation.

## 8. Queries / proyecciones

M1.1 debe ofrecer como mínimo:

- OrganizationTree(organizationId)
- SiteFacilityTree(siteId)
- FacilityCapacity(siteId|houseId|bedId|bankId)
- PositionOccupancy(parentId)
- PlantById(plantId)
- PlantLocation(plantId)
- PlantsByLocation(locationRef)
- PlantGenealogy(plantId)
- PlantPassportSummary(plantId)
- AvailablePositions(parentId)

Las consultas son proyecciones; no crean nueva autoridad.

## 9. UX obligatoria

### Navegación

1. Seleccionar empresa.
2. Seleccionar sede.
3. Navegar Nave/Área.
4. Abrir Cama o Banco.
5. Visualizar posiciones y ocupación.
6. Seleccionar una planta.
7. Abrir exactamente su Plant Passport conservando Plant ID.

### Edición

- Empresa, sede, nave/área, cama y banco deben poder editarse con permisos.
- Si existe historia, la UI ofrece archivar/desactivar, no borrado destructivo.
- Errores de validación deben ser visibles y asociados al campo/acción.
- Fecha/hora debe seguir patrón Safari-safe aprobado.
- La navegación móvil debe mantener targets táctiles y no ocultar estado operativo.

## 10. Permisos mínimos

Roles concretos quedan configurables, pero las capabilities mínimas son:

- organization.read
- organization.manage
- site.read
- site.manage
- facility.read
- facility.manage
- plant.read
- plant.create
- plant.move
- plant.lifecycle.manage
- plant.retire
- genealogy.read
- genealogy.manage

Toda mutación registra actor y organización.

## 11. Auditoría y trazabilidad

Cada operación crítica debe permitir reconstruir:

`Quién → Qué → Sobre qué objeto → En qué empresa/sede → Cuándo → Desde qué estado → A qué estado`

No se admite una actualización silenciosa de identidad, ubicación o lifecycle.

## 12. Vertical slices de implementación

### Slice M1.1-A — Organization + Site

Definition of Done:
- CRUD gobernado mediante Commands.
- archive en lugar de delete cuando exista historia.
- tenant isolation.
- eventos + ledger + tests.
- UI responsive y Safari-safe.

### Slice M1.1-B — Facility Tree

Definition of Done:
- Site → House/Area → Zone → Bed/Bank.
- capacidad calculada.
- IDs estables.
- validación de parentesco y tenant.
- Operational Map consume la misma jerarquía.

### Slice M1.1-C — Positions

Definition of Done:
- generación determinista de posiciones por Bed/Tray.
- activación/desactivación gobernada.
- no reutilización destructiva de identidad.
- ocupación consultable.

### Slice M1.1-D — Plant Identity

Definition of Done:
- PlantIdentity individual.
- GeneticProfile asociado.
- genealogy básica.
- materialización de abuelas/madres/esquejes sin IDs duplicados.
- Plant Passport abre por ID estable.

### Slice M1.1-E — Movement + Lifecycle

Definition of Done:
- move no reemplaza identidad.
- historial de ubicación completo.
- lifecycle event-driven.
- posiciones liberadas/asignadas consistentemente.
- audit y pruebas de concurrencia.

### Slice M1.1-F — Operational Map integration

Definition of Done:
- una sola jerarquía espacial compartida.
- selección de planta abre el registro exacto.
- MIPE/MIRFE/Inventory podrán reutilizar locationRef sin duplicar mapas.

## 13. Pruebas obligatorias

### Unitarias
- validación de jerarquía.
- capacidad.
- identidad estable.
- genealogy acíclica.
- tenant boundaries.
- archive semantics.

### Integración
- Command → Event → Ledger → Projection → Query.
- MovePlant mantiene PlantIdentity.
- cambio de empresa no filtra datos de otro tenant.
- bootstrap/sync preserva la partición activa.

### Adversariales
- parent cross-tenant.
- duplicate stable ID.
- mover planta a posición inexistente/inactiva.
- dos plantas intentando ocupar la misma posición.
- archivar padre con hijos activos.
- ciclo genealógico.
- retry del mismo Command/Event sin duplicar efectos.

### UX
- Safari/iPad.
- mobile navigation.
- fecha/hora separadas cuando corresponda.
- estados loading/error/empty/success.
- accesibilidad WCAG 2.2 AA aplicable.

## 14. Criterio de salida de M1.1

M1.1 queda completo únicamente cuando:

1. Organization/Site/Facility/Position/PlantIdentity tienen ownership inequívoco.
2. La jerarquía física usa IDs estables y es compartida por Operational Map.
3. PlantIdentity sobrevive movimientos y cambios de lifecycle.
4. Tenant isolation está probada adversarialmente.
5. No existe delete destructivo de objetos con historia.
6. Commands, Events, Queries, permissions y audit están implementados.
7. Quality está verde.
8. Mini re-auditoría M1.1 no encuentra hallazgos críticos/altos abiertos.

## 15. Fuera de alcance de M1.1

No se implementan todavía como parte de este bloque:
- MIRFE completo.
- MIPE completo.
- Inventory/Mass Balance completo.
- QMS/Compliance.
- Laboratory.
- Postharvest completo.
- Economic Engine.
- AI/Agents/Simulation.

M1.1 únicamente debe dejar el núcleo operativo listo para que esos dominios lo consuman sin duplicar identidad, ubicación o ownership.
