# AUD-F024 — Precedencia autoritativa del Knowledge Graph

## Hallazgo

La política común de reconciliación comparaba primero `updatedAt` y solo después la autoridad de la fuente. Una fuente derivada o inferior con una fecha posterior podía desplazar un nodo proveniente de Ledger, IoT certificado u otra fuente autoritativa.

## Corrección

`compareProjectionCandidates()` aplica ahora este orden determinista:

1. autoridad de la fuente;
2. versión del objeto;
3. evidencia temporal (`recordedAt`, `updatedAt`, `occurredAt`, `createdAt`);
4. huella canónica como desempate estable.

Una fuente inferior nunca degrada una fuente superior, aunque presente una fecha futura o una versión inflada. La fecha solo desempata candidatos de autoridad y versión equivalentes.

## Evidencia

- Política autoritativa: `51247ac315c57dbb83feed3b0715e07c054bc100`
- Pruebas unitarias de precedencia: `59520c6222325f5881b71bb53bd3894022c0dcd1`
- Pruebas Passport → Graph: `8b0cfd0f96474ac7b93c72d4f2a51a589ebddf25`
- Fixtures temporales válidos: `6b538f90ff71d790f447058bd02640aec08ae2b1`

## Quality

- `#872`: falló por cuatro fixtures hostiles temporalmente inválidos; la implementación y la política nueva sí pasaron.
- `#874`: success técnico final.

## Prueba directa

Se verificó que:

- Ledger histórico prevalece sobre Passport con fecha futura;
- una referencia Passport futura no desplaza un nodo IoT certificado;
- una fuente IoT prevalece sobre usuario aunque el usuario tenga fecha futura y versión inflada;
- la versión desempata fuentes iguales antes de la fecha;
- `recordedAt` desempata antes de `updatedAt` cuando autoridad y versión coinciden;
- el ganador no depende del orden de llegada.

## Resultado de reauditoría

La revisión de `passportGraphProjection.js`, `graphRepository.js` y `knowledgeGraph.js` no encontró otra política paralela de “timestamp más reciente gana”. La API heredada que no actualiza nodos existentes corresponde al hallazgo independiente `AUD-F026`.

## Riesgo residual

Ninguno dentro del alcance de precedencia entre fuentes. Las APIs heredadas y la consolidación de escritura se atenderán en `AUD-F026` y `AUD-F030`.
