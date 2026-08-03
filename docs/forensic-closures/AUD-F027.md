# AUD-F027 — Identidad semántica de relaciones del Knowledge Graph

## Hallazgo

La deduplicación semántica del repositorio utilizaba únicamente organización, tipo, extremos y vigencia. Dos afirmaciones distintas sobre los mismos objetos podían colapsar aunque tuvieran distinta fuente, confianza o evidencia en metadata.

La API heredada `connect()` repetía el mismo defecto al buscar previamente una relación por tipo y extremos antes de delegar al repositorio.

## Corrección

La identidad semántica de una arista incorpora ahora:

- organización;
- tipo de relación;
- nodos origen y destino;
- fuente;
- confianza;
- vigencia;
- metadata canónica.

`edgeId` y `createdAt` no forman parte de la equivalencia semántica. Dos copias exactas con IDs distintos convergen, mientras afirmaciones con evidencia, fuente o confianza diferente coexisten.

La API heredada eliminó su deduplicación paralela y delega completamente en `repository.addEdge()`.

## Evidencia

- Repositorio canónico: `3afc731b37ff4fb2ed9998014d102a26556564f5`
- Pruebas iniciales: `0780af112ea410b0366b37cc6b3ea5ccbf64a511`
- Fachada heredada: `d7e954aee08532e55943b90bd83bd8744353476f`
- Prueba de la fachada: `09023975bb7af6a1ce6be25c068d76863cdfa41d`
- Fixture heredado con identidad explícita: `db22ec3a7a63da4acfefadc580aec13a5a4a730c`

## Quality

- `#891`: success inicial del repositorio.
- Reauditoría: detectó deduplicación residual en `createKnowledgeGraph().connect()`.
- `#896`: falló por una expectativa heredada que generaba dos IDs aleatorios y esperaba idempotencia.
- `#898`: success técnico final.

## Pruebas directas

Se verificó que:

- fuentes distintas pueden afirmar la misma relación;
- metadata distinta conserva aristas separadas;
- niveles de confianza distintos no colapsan;
- copias equivalentes convergen aunque cambie el orden de propiedades;
- `replaceAll()` rechaza duplicados equivalentes atómicamente;
- la API heredada conserva relaciones con atributos distintos;
- una operación idempotente declara explícitamente el mismo `relationId`.

## Resultado de reauditoría

No queda una ruta paralela que deduplique únicamente por tipo y extremos. Passport, APIs canónicas y API heredada convergen en la misma política del repositorio.

## Riesgo residual

Ninguno dentro del alcance de identidad semántica de relaciones.