# AUD-F026 — Reconciliación canónica de la API heredada del Knowledge Graph

## Hallazgo

`createKnowledgeGraph().upsertNode()` devolvía inmediatamente el nodo existente. No evaluaba contenido, fecha, versión ni autoridad y, por tanto, mantenía una segunda semántica de escritura diferente de la proyección canónica Passport → Graph.

## Corrección

La API heredada ahora:

1. normaliza el nodo heredado al contrato canónico;
2. declara `metadata.source = legacy-api`;
3. compara el candidato entrante con el vigente mediante `preferredProjectionCandidate()`;
4. reemplaza el nodo únicamente cuando el candidato entrante gana;
5. conserva todas las aristas durante el reemplazo mediante `repository.replaceAll()`;
6. devuelve la representación del candidato efectivamente seleccionado.

Una escritura heredada no puede degradar Ledger, IoT certificado, Passport u otra fuente de mayor autoridad, aunque presente una fecha futura.

## Evidencia

- Reconciliación de `upsertNode()`: `11c33f71430e1f5eef96818f205f8af155c9b559`
- Pruebas adversariales: `b9d32ecdd8d83f3ddaa27675edb914e9d6b1a3d7`

## Pruebas

Se verificó que:

- una actualización posterior modifica etiqueta, estado, atributos y fecha;
- una actualización más antigua no degrada el nodo vigente;
- las relaciones se preservan al reemplazar el nodo;
- una escritura heredada futura no desplaza un nodo Ledger;
- el resultado converge independientemente del orden de llegada.

## Quality

- `#886`: success técnico final.

## Reauditoría

Se revisaron `upsertNode()`, `connect()`, `snapshot()`, recorridos y el repositorio canónico. No quedó una segunda política de reconciliación. `repository.addNode()` conserva intencionalmente semántica de inserción estricta y no pretende ser un upsert.

## Riesgo residual

Ninguno dentro del alcance de actualización de nodos mediante la API heredada.