# Cierre forense — AUD-F008 y AUD-F044

## Alcance

Este expediente certifica conjuntamente los hallazgos relacionados con la autoridad circular entre Store y Operational Ledger y con la rehidratación continua mediante snapshots potencialmente atrasados.

## Hallazgos

### AUD-F008 — React/Ledger

La rehidratación continua ejecutaba `replaceMany()` cada vez que cambiaba `state.operationalLedgerEntries`. Un snapshot atrasado podía reemplazar el Ledger vigente y eliminar entradas aceptadas después de haberse capturado dicho snapshot.

### AUD-F044 — Store/Ledger

Store y Ledger actuaban simultáneamente como autoridad. El Ledger escribía entradas en el Store, mientras que cualquier cambio posterior del Store podía reemplazar por completo el Ledger en memoria.

## Corrección aplicada

- El Operational Ledger se establece como autoridad canónica en memoria.
- Se incorpora `reconcileMany()` como operación atómica y no destructiva.
- Los snapshots del Store únicamente pueden aportar entradas históricas faltantes.
- Una entrada ya existente en el Ledger no puede ser eliminada por un snapshot atrasado.
- Las entradas históricas reconciliadas no notifican listeners ni reemiten efectos operativos.
- El bridge persiste hacia el Store el snapshot canónico completo, ordenado y limitado.
- Se elimina del bridge la llamada reactiva a `replaceMany(state.operationalLedgerEntries)`.

## Commits técnicos

- `f8c949b93b7dd95f226b0aac8c06dc496b8b1ddc` — reconciliación atómica no destructiva.
- `9c7ee55eca4561af38128ab7b5f9048decf8f4af` — autoridad canónica del Ledger en el bridge.
- `2ee3d26adda2a211706dabe6039070a84a703c5c` — pruebas específicas y reauditoría automatizada.

## Pruebas directas

La suite certifica que:

1. un snapshot atrasado no elimina entradas vigentes;
2. un snapshot remoto puede aportar entradas faltantes;
3. la reconciliación no reemite eventos históricos;
4. una colisión de secuencia invalida el lote completo;
5. el contador de secuencia continúa correctamente;
6. el bridge no utiliza reemplazo destructivo reactivo;
7. el Store converge nuevamente al snapshot canónico del Ledger.

## Quality

- Workflow: `Quality #536`
- Commit certificado: `2ee3d26adda2a211706dabe6039070a84a703c5c`
- Resultado: `success`

## Resultado de reauditoría

Los caminos de autoridad quedaron separados:

- Event Bus → Ledger: append operativo.
- Snapshot Store → Ledger: reconciliación histórica no destructiva.
- Ledger → Store: persistencia del snapshot canónico.

Ya no existe un camino por el cual un snapshot atrasado del Store pueda revertir el Ledger vigente.

## Riesgo residual

La reconciliación protege el Ledger frente a snapshots atrasados, pero no resuelve todavía las carreras generales de bootstrap y sincronización del resto del Store. Esos riesgos permanecen registrados en `AUD-F042` y `AUD-F043` y deben sanearse a continuación.

## Estado

- `AUD-F008`: **Cerrado y certificado**.
- `AUD-F044`: **Cerrado y certificado**.
