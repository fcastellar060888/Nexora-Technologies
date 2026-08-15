# AUD-F028 — Limpieza de referencias provisionales del Passport

## Hallazgo

La proyección Passport → Knowledge Graph eliminaba globalmente cualquier nodo provisional sin aristas después de reproyectar un Passport. Esto permitía que la actualización de un Passport borrara referencias provisionales creadas por otro Passport o por otra proyección, aunque no pertenecieran al alcance de la operación actual.

## Causa raíz

`removeOrphanPassportReferences()` recorría todos los nodos del repositorio y eliminaba cada nodo con `metadata.source === 'passport-reference'` que no apareciera conectado en el snapshot resultante.

La función no conocía qué nodos habían quedado candidatos a limpieza por retirar las aristas del Passport actual.

## Corrección

La proyección ahora:

1. identifica las aristas que pertenecían al `passportId` reproyectado;
2. obtiene exclusivamente sus nodos destino como candidatos de limpieza;
3. retira las aristas antiguas;
4. incorpora la nueva proyección;
5. elimina un candidato únicamente cuando sigue siendo provisional y ya no conserva ninguna arista.

Los nodos provisionales ajenos nunca se inspeccionan ni eliminan durante esta operación.

## Evidencia

- Limpieza acotada al Passport actual: `580e8318b3508ddacb4ed79f65e081a01a89cf02`
- Pruebas forenses: `8137fba5d5ff514633027321174c59f6b52a1bf5`

## Pruebas directas

Se verificó que:

- reproyectar un Passport no elimina un provisional ajeno sin aristas;
- un destino provisional obsoleto del Passport actual sí se elimina;
- un destino compartido permanece mientras otro Passport conserve una arista;
- una arista de otra fuente protege el nodo provisional;
- una proyección inválida no ejecuta limpieza parcial ni incrementa la versión.

## Quality

- `#904`: success técnico completo.

La ejecución aprobó auditoría estática, suite automatizada y build de producción.

## Resultado de reauditoría

No se encontró otra rutina de garbage collection global en el repositorio canónico ni en la API heredada. La única limpieza automática de referencias provisionales queda limitada a los destinos retirados del Passport que se reproyecta.

## Riesgo residual

Ninguno dentro del alcance de limpieza de referencias provisionales del Passport.
