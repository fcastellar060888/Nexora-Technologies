# AUD-F025 — Evidencia completa del Objeto Inteligente en Knowledge Graph

## Hallazgo

La proyección del nodo principal desde Passport hacia Knowledge Graph conservaba únicamente identidad técnica, etiqueta, estado, fechas, sede y versión. Los campos de dominio `identity`, `attributes` y `metadata` del Objeto Inteligente se descartaban, por lo que el nodo no podía representar fielmente la evidencia que originó el Passport.

## Corrección

El nodo principal conserva ahora una instantánea explícita en `metadata.intelligentObject` con:

- `objectType`;
- `objectId`;
- `organizationId`;
- `siteId`;
- `version`;
- `identity`;
- `attributes`;
- `metadata`.

La metadata técnica del Graph permanece separada mediante `source`, `passportId` y `objectVersion`. `createGraphNode()` clona y congela profundamente la instantánea, por lo que no comparte referencias con el Passport ni con sus productores.

## Evidencia

- Proyección completa del Objeto Inteligente: `95c09d5183fc278aa2f78a36be968b6e872fc223`
- Pruebas forenses específicas: `2d8ca4cb2b90b57a59002f6c909aa9f6dba2f64d`

## Quality

- `#880`: success técnico final.

## Prueba directa

Se verificó que:

- el nodo principal conserva exactamente identidad, atributos y metadata de dominio;
- la evidencia no comparte referencias y queda profundamente inmutable;
- una nueva versión del mismo Passport actualiza también la evidencia proyectada;
- un Objeto Inteligente incompleto se rechaza antes de modificar el repositorio;
- snapshots y lecturas del repositorio conservan la instantánea completa.

## Resultado de reauditoría

La revisión de `passportGraphProjection.js`, `graphContract.js`, `graphRepository.js` y la política de precedencia confirmó que la evidencia se conserva durante inserción, reconciliación y snapshot. Una fuente superior continúa protegida por la política authority-first certificada en `AUD-F024`.

## Riesgo residual

La API heredada del Knowledge Graph mantiene una ruta de escritura distinta y corresponde al hallazgo independiente `AUD-F026`. No se introdujo compatibilidad silenciosa ni duplicación de autoridad dentro de la proyección Passport → Graph.
