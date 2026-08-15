export const NEXORA_DOMAIN_MODEL_VERSION='1.0.0'

export const DATA_SOURCES=Object.freeze({
 MANUAL:'MANUAL',
 SENSOR:'SENSOR',
 CONTROLLER:'CONTROLLER',
 SAMPLE:'SAMPLE',
 IMPORTED:'IMPORTED',
 CALCULATED:'CALCULATED',
 INFERRED:'INFERRED'
})

export const DOMAIN_ENGINES=Object.freeze({
 ORGANIZATION:{id:'ORGANIZATION',label:'Organization & Access',entities:['Organization','Site','User','Membership','Role','Permission']},
 FACILITY:{id:'FACILITY',label:'Facility Engine',entities:['FacilitySpace','SpaceZone','SpaceCapability','SpaceBooking','Bed','Bank','Tray','Position','ContainerProfile','StorageArea','EnvironmentalZone']},
 PLANT:{id:'PLANT',label:'Genetics & Plant Engine',entities:['GeneticProfile','PlantIdentity','PlantLifecycle','PlantRelationship','PlantPassport','Grandmother','Mother','Clone','ProductionPlant','PropagationBatch','ProductionLot']},
 GROWING_MEDIUM:{id:'GROWING_MEDIUM',label:'Growing Medium Engine',entities:['GrowingMediumProduct','GrowingMediumFormula','GrowingMediumBatch','GrowingMediumAssignment','ReusePolicy','ReuseCycle','PurchaseRequirement']},
 IRRIGATION:{id:'IRRIGATION',label:'Irrigation & MIRFE Engine',entities:['IrrigationEmitter','IrrigationAssignment','IrrigationSector','IrrigationPulse','IrrigationMeasurement','DrainageMeasurement','FertigationProduct','FertigationFormula','FertigationPreparation','FertigationApplication','SensorDevice','ControllerDevice']},
 MIPE:{id:'MIPE',label:'MIPE Engine',entities:['Pest','Disease','Finding','TreatmentProduct','TreatmentProgram','TreatmentApplication','ResistanceGroup','SafetyDocument']},
 ENVIRONMENT:{id:'ENVIRONMENT',label:'Environment Engine',entities:['EnvironmentalZone','EnvironmentalReading','EnvironmentalTarget','EnvironmentalAlert','ControlSetpoint','ControlAction','DeviceIntegration','CalibrationRecord']},
 BIOMASS:{id:'BIOMASS',label:'Biomass & Postharvest Engine',entities:['BiomassLot','BiomassMovement','BiomassClassification','WasteStream','HarvestReception','DryingRun','StemmingRun','TrimmingRun','SelectionRun','PackagingRun','ExtractionAllocation']},
 QUALITY:{id:'QUALITY',label:'Quality & Compliance Engine',entities:['Laboratory','AnalyticalMethod','Sample','AnalysisRequest','AnalysisPanel','AnalysisResult','COA','SpecificationProfile','LotRelease','License','LicenseCapacity','RegulatoryRequirement']},
 INVENTORY:{id:'INVENTORY',label:'Inventory & Commercial Engine',entities:['InventoryItem','InventoryLot','InventoryLocation','InventoryMovement','FlowerGrade','Package','Reservation','Sale','ExtractionInventory']},
 KNOWLEDGE:{id:'KNOWLEDGE',label:'Knowledge Engine',entities:['KnowledgeItem','TechnicalSheet','Protocol','SOP','ProductCatalog','SupplierCatalog','EvidenceDocument','KnowledgeVersion']},
 INTELLIGENCE:{id:'INTELLIGENCE',label:'Intelligence Engine',entities:['MetricDefinition','Observation','FeatureSet','Recommendation','Prediction','Anomaly','DecisionRecord']}
})

export const CANONICAL_EVENTS=Object.freeze([
 'facility.space.created',
 'facility.space.updated',
 'plant.identity.created',
 'plant.lifecycle.changed',
 'plant.relationship.created',
 'propagation.batch.created',
 'propagation.unit.promoted',
 'irrigation.pulse.recorded',
 'environment.reading.recorded',
 'biomass.movement.recorded',
 'quality.sample.collected',
 'quality.result.recorded',
 'quality.lot.released',
 'inventory.movement.recorded',
 'compliance.license.expiring'
])

export const IMPLEMENTATION_PRIORITY=Object.freeze([
 'FACILITY',
 'PLANT',
 'GROWING_MEDIUM',
 'IRRIGATION',
 'ENVIRONMENT',
 'BIOMASS',
 'QUALITY',
 'INVENTORY',
 'INTELLIGENCE'
])

export function getDomainEngine(engineId){
 const engine=DOMAIN_ENGINES[String(engineId||'').toUpperCase()]
 if(!engine)throw new Error(`Motor de dominio desconocido: ${engineId}`)
 return engine
}

export function findEntityOwner(entityName){
 const name=String(entityName||'').trim()
 if(!name)return null
 return Object.values(DOMAIN_ENGINES).find(engine=>engine.entities.includes(name))||null
}

export function isCanonicalDataSource(source){return Object.values(DATA_SOURCES).includes(source)}
export function isCanonicalEvent(eventName){return CANONICAL_EVENTS.includes(eventName)}
