# Cierre forense — AUD-F010

## Hallazgo

**AUD-F010 — Timeline:** el orden y la retención basados únicamente en `occurredAt` podían eliminar un evento recién confirmado por el Operational Ledger cuando ese evento representaba un hecho histórico.

## Causa raíz

El motor utilizaba el mismo comparador temporal para dos responsabilidades distintas:

1. ordenar visualmente el Timeline por la fecha del hecho;
2. decidir qué entradas conservar al alcanzar `maxEntries`.

Al insertar un evento nuevo con `sequence` reciente pero `occurredAt` antiguo, la lista se ordenaba por la fecha histórica y `trim()` eliminaba sus primeras posiciones. El evento nuevo podía desaparecer inmediatamente aunque fuese la evidencia más reciente del Ledger.

## Corrección

- El orden de visualización continúa usando `occurredAt`, con secuencia e ID como desempates estables.
- La retención usa una política independiente y canónica:
  1. `sequence` del Ledger;
  2. `recordedAt`;
  3. `occurredAt` solo como fallback para entradas heredadas;
  4. ID como desempate final.
- Las entradas con autoridad del Ledger prevalecen sobre entradas directas sin secuencia.
- `record()` y `hydrate()` aplican la misma política de retención.
- El contrato valida también `recordedAt` cuando está presente.

## Evidencia

- Motor corregido: `425f6aedb2be726179f80e9f3c6ed07f55bf0678`
- Pruebas forenses: `4559457e7cb0950dc234e0d6921509457bacfc7c`
- Prueba directa: `tests/block-c-aud-f010-timeline-retention.test.mjs`

## Pruebas directas

La batería demuestra que:

1. un evento histórico recién confirmado no es eliminado por su `occurredAt`;
2. `hydrate()` conserva las secuencias más nuevas y mantiene el orden visual histórico;
3. `recordedAt` gobierna la retención cuando no existe secuencia.

## Quality

- Quality técnico `#822`: **success**.
- Auditoría estática, suite automatizada completa y build de producción: aprobados.

## Reauditoría independiente

Se revisaron inserción incremental, hidratación, mezcla de entradas con y sin secuencia, límites de retención y consulta ascendente/descendente. No se encontró una ruta residual donde la fecha del hecho controle indebidamente la conservación de evidencia nueva.

## Riesgo residual

Las entradas heredadas sin `sequence` ni `recordedAt` conservan como fallback el orden por `occurredAt`. Esto es deliberado: carecen de evidencia de ingestión más autoritativa y no pueden desplazar entradas confirmadas por el Ledger.

## Dictamen

`AUD-F010` queda **cerrado y certificado**.
