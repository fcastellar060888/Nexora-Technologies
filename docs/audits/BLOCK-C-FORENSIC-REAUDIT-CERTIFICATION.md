# Certificación de reauditoría forense — Bloque C

Fecha: 2026-08-03
Rama: `foundation/event-bus-core`
Estado: **CERTIFICADO**

## Alcance

Se reauditaron de forma transversal los hallazgos cerrados del Bloque C, incluyendo Timeline, Passport, Knowledge Graph, sus contratos, reconciliación, concurrencia, retención, lifecycle y runtime productivo por workspace.

## Controles permanentes incorporados

La suite `tests/block-c-full-forensic-reaudit.test.mjs` verifica:

1. Ninguna ruta productiva crea repositorios del Knowledge Graph fuera del runtime canónico.
2. Existe un único `KnowledgeGraphRuntimeProvider`, montado dentro de `StoreProvider`.
3. La API canónica no vuelve a exportar símbolos heredados.
4. Event Bus, Operational Ledger, Timeline y Knowledge Graph están aislados por `organizationId + actorId`.
5. Liberar un scope no contamina otros workspaces y la recreación comienza limpia.
6. Toda sustitución productiva mediante `replaceAll()` declara `expectedVersion`.

## Incidencias durante la reauditoría

Las ejecuciones #960, #962 y #964 fallaron por incompatibilidades del nuevo fixture forense con APIs contractuales vigentes:

- nombre incorrecto de la función de liberación del Timeline;
- forma histórica del agregado al crear eventos;
- consulta inexistente `getEntries()` en el Ledger.

Ninguna de estas incidencias correspondió a una regresión productiva. Los fixtures fueron alineados con las APIs canónicas y la lógica de producción no fue modificada.

## Evidencia final

- Commit de prueba inicial: `aaf92a878ec9829fa244435fa6af2b6ed0d80144`
- Corrección lifecycle Timeline: `53e04d7fde58fe927fbdd2b4afa928865881ec68`
- Corrección contrato de evento: `cd4c99c6fcef7e4fff712bb745c11a6f5e76763d`
- Corrección consulta contractual del Ledger: `62f4089dd2716dea9af28eeff543a9307a5928d8`
- Quality técnico final: **#966 — success**
- Auditoría estática: **success**
- Suite automatizada: **535/535 pruebas aprobadas**
- Build de producción: **success**

## Conclusión

No se encontraron regresiones productivas ni rutas residuales que reabran los hallazgos certificados del Bloque C. El bloque conserva autoridad única, aislamiento multiworkspace, atomicidad, inmutabilidad, reconciliación determinista y control optimista de concurrencia.

El siguiente paso autorizado es la reauditoría cruzada de los Bloques A+B+C antes de iniciar el Bloque D.
