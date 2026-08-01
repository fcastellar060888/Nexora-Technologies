# Nexora Domain Model v1.0

## Propósito

Nexora es un sistema operativo para cannabis que conecta la operación física, el ciclo de vida vegetal, la biomasa, la calidad, el cumplimiento, el inventario y la inteligencia operacional. Este documento define el vocabulario canónico y las reglas de integración que deben respetar todos los módulos.

## Principios

1. La planta y el material vegetal conservan identidad y genealogía durante todo su ciclo.
2. Los lotes son agrupaciones operativas; no sustituyen la identidad individual.
3. Todo dato debe conservar contexto de empresa, sede, espacio, fecha, responsable y fuente.
4. Ningún resultado histórico se sobrescribe: se versiona y se relaciona.
5. Los flujos de biomasa deben mantener balance de masa y destino regulatorio.
6. Las configuraciones técnicas son editables por cliente y no deben quedar codificadas como reglas universales.
7. Las automatizaciones nunca deben ocultar si un dato es observado, calculado, importado o estimado.

## Motores de dominio

### 1. Organization & Access

Entidades principales:
- Organization
- Site
- User
- Membership
- Role
- Permission

Responsabilidad: aislamiento multiempresa, acceso por sede, auditoría y responsables operativos.

### 2. Facility Engine

Entidades principales:
- FacilitySpace
- SpaceZone
- SpaceCapability
- SpaceBooking
- Bed
- Bank
- Tray
- Position
- ContainerProfile
- StorageArea
- EnvironmentalZone

Jerarquía compatible:

Organization → Site → FacilitySpace → SpaceZone → Bed/Bank/Room → Tray/Row → Position → Container/Plant

Un espacio puede admitir varias capacidades. Ejemplo: una sala en Villeta puede servir para manicura y empaque, de forma secuencial o por subzonas.

### 3. Genetics & Plant Engine

Entidades principales:
- GeneticProfile
- PlantIdentity
- PlantLifecycle
- PlantRelationship
- PlantPassport
- Grandmother
- Mother
- Clone
- ProductionPlant
- PropagationBatch
- ProductionLot

Genealogía mínima:

Genética → Abuela individual → Madre individual → Esqueje individual → Planta productiva → Cosecha → Sublote → Empaque

Las genéticas incluyen clasificación regulatoria y comercial, como THC, CBD o mixta, además de parámetros agronómicos configurables.

### 4. Growing Medium Engine

Entidades principales:
- GrowingMediumProduct
- GrowingMediumFormula
- GrowingMediumBatch
- GrowingMediumAssignment
- ReusePolicy
- ReuseCycle
- PurchaseRequirement

Debe soportar coco, turba, tierra, mezclas, jiffy, plug y medios personalizados. Cada asignación registra volumen, lote del proveedor, costo y ciclo de reutilización.

Ejemplo configurable de Canapa:
- contenedor productivo: matera de 10 L;
- reposición parcial: 30 %;
- remanente reutilizado: 70 %;
- cambio total después del número configurado de ciclos.

### 5. Irrigation & MIRFE Engine

Entidades principales:
- IrrigationEmitter
- IrrigationAssignment
- IrrigationSector
- IrrigationPulse
- IrrigationMeasurement
- DrainageMeasurement
- FertigationProduct
- FertigationFormula
- FertigationPreparation
- FertigationApplication
- SensorDevice
- ControllerDevice

Configuraciones soportadas:
- anillo por planta;
- gotero con varias estacas por planta;
- gotero compartido entre plantas;
- múltiples emisores;
- riego manual;
- integración automática.

Las mediciones deben indicar fuente: SENSOR, CONTROLADOR, MANUAL, MUESTRA, IMPORTADO o CALCULADO.

### 6. MIPE Engine

Entidades principales:
- Pest
- Disease
- Finding
- TreatmentProduct
- TreatmentProgram
- TreatmentApplication
- ResistanceGroup
- SafetyDocument

Los productos deben tener ficha técnica estructurada, registro aplicable, ingrediente activo, concentración, modo de acción, dosis, restricciones, compatibilidades, documentos y versiones. El catálogo global es editable y ampliable por cliente.

### 7. Environment Engine

Entidades principales:
- EnvironmentalZone
- EnvironmentalReading
- EnvironmentalTarget
- EnvironmentalAlert
- ControlSetpoint
- ControlAction
- DeviceIntegration
- CalibrationRecord

Debe cubrir cultivo y postcosecha: naves, bancos, secado, recepción, manicura, empaque, almacenes y áreas compartidas.

Variables típicas:
- temperatura;
- humedad relativa;
- VPD;
- punto de rocío;
- CO2;
- luz;
- humedad y temperatura de sustrato;
- caudal, presión y drenaje;
- estado de equipos.

### 8. Biomass & Postharvest Engine

Entidades principales:
- BiomassLot
- BiomassMovement
- BiomassClassification
- WasteStream
- HarvestReception
- DryingRun
- StemmingRun
- TrimmingRun
- SelectionRun
- PackagingRun
- ExtractionAllocation

Flujo de balance de masa:

Biomasa cosechada → descarte fitosanitario → entrada a secado → pérdida de humedad → flor seca → destalle → flor para manicura → trim → flor manicurada → clasificación → empaque → inventario

Todo descarte debe registrar tipo, peso, origen, destino, evidencia y responsable. Los destinos regulatorios serán configurables y versionados por jurisdicción y licencia.

### 9. Quality & Compliance Engine

Entidades principales:
- Laboratory
- AnalyticalMethod
- Sample
- AnalysisRequest
- AnalysisPanel
- AnalysisResult
- COA
- SpecificationProfile
- LotRelease
- License
- LicenseCapacity
- RegulatoryRequirement

Debe permitir:
- análisis completos o parciales;
- múltiples laboratorios para una misma muestra o lote;
- comparación entre métodos y laboratorios;
- reanálisis y versiones;
- perfiles de liberación por mercado o cliente;
- estados Liberado, Condicionado, Retenido o Rechazado.

Los resultados solo se comparan automáticamente cuando método, unidad, base de cálculo y muestra son técnicamente compatibles.

### 10. Inventory & Commercial Engine

Entidades principales:
- InventoryItem
- InventoryLot
- InventoryLocation
- InventoryMovement
- FlowerGrade
- Package
- Reservation
- Sale
- ExtractionInventory

Debe soportar clasificaciones editables como C, A, AA y AAA, pesos por bolsa, inventario por sede, genética, THC/CBD, calidad, liberación y destino comercial.

### 11. Knowledge Engine

Entidades principales:
- KnowledgeItem
- TechnicalSheet
- Protocol
- SOP
- ProductCatalog
- SupplierCatalog
- EvidenceDocument
- KnowledgeVersion

Aloja productos MIPE/MIRFE, genéticas, medios, sensores, equipos, laboratorios, métodos, plagas, enfermedades y procedimientos. Los registros globales pueden ser adaptados o extendidos por cada cliente.

### 12. Intelligence Engine

Entidades principales:
- MetricDefinition
- Observation
- FeatureSet
- Recommendation
- Prediction
- Anomaly
- DecisionRecord

La inteligencia debe diferenciar:
- dato observado;
- cálculo;
- correlación;
- inferencia;
- recomendación;
- acción autorizada.

## Fuentes de datos

Valores permitidos como base transversal:
- MANUAL
- SENSOR
- CONTROLLER
- SAMPLE
- IMPORTED
- CALCULATED
- INFERRED

## Eventos canónicos iniciales

- facility.space.created
- facility.space.updated
- plant.identity.created
- plant.lifecycle.changed
- plant.relationship.created
- propagation.batch.created
- propagation.unit.promoted
- irrigation.pulse.recorded
- environment.reading.recorded
- biomass.movement.recorded
- quality.sample.collected
- quality.result.recorded
- quality.lot.released
- inventory.movement.recorded
- compliance.license.expiring

## Reglas de compatibilidad

1. Las colecciones actuales de naves, camas, bancos, bandejas, abuelas, madres y lotes seguirán funcionando mediante proyecciones compatibles.
2. Las migraciones serán incrementales y no destructivas.
3. Todo nuevo motor debe publicar eventos, integrarse con Timeline, Operational Ledger, Passport y Knowledge Graph.
4. Las pantallas son consumidores del dominio; no deben contener reglas de negocio exclusivas.

## Prioridad de implementación

1. Facility Engine configurable.
2. Plant/Propagation Promotion Engine visible.
3. Growing Medium y reutilización.
4. Irrigation y Environment.
5. Biomass Balance.
6. Quality & Compliance.
7. Inventory comercial y extracción.
8. Intelligence.

## Estado

Versión: 1.0.0
Estado: Base normativa de arquitectura
Fecha de adopción: 2026-08-01
