# AUD-F034 — Idempotencia persistente del Projection Engine

## Hallazgo

El Projection Engine conservaba los identificadores procesados únicamente en un `Set` local. La garantía desaparecía al recrear el motor y dos instancias podían proyectar simultáneamente el mismo evento.

## Corrección

Se introdujo `ProjectionCheckpointStore` como autoridad externa e inyectable con:

- `claim(key)` atómico;
- `complete(token)`;
- `release(token)`;
- `has(key)`;
- `hydrate(checkpoints)`;
- `snapshot()`.

La API pública `createProjectionEngine()` resuelve ahora una fachada persistente. El motor anterior queda expuesto únicamente como `createVolatileProjectionEngine` para pruebas y diagnóstico explícitos.

La ejecución live adquiere un claim por `eventId + firma del registro de proyectores`. La firma contiene `projectorId@version`, de modo que una nueva versión puede reproyectar el mismo evento. Una ejecución fallida o bloqueada libera el claim; únicamente una ejecución completa confirma el checkpoint.

Además se mantienen checkpoints por proyector para que `hasProcessed(eventId, projectorId, version)` sobreviva a rehidratación sin considerar procesados los proyectores que declararon el evento como no soportado.

`replay()` continúa fuera de la idempotencia live de forma intencional y no consume ni crea checkpoints.

## Pruebas directas

- El snapshot de checkpoints se hidrata en un motor recreado y evita reproyección.
- Dos motores con el mismo backend comparten un claim atómico y solo uno ejecuta.
- Un fallo libera el claim y permite reintento posterior.
- Replay no contamina checkpoints live.
- La deduplicación local conserva la razón histórica `already-processed`.
- Un proyector no soportado no queda marcado como procesado.

## Evidencia

- `55caf4e44c4e025519afa0f00ca61ecf30615103` — contrato de checkpoints.
- `7e2f2d92a4a3985194751de54868945aa16c6825` — fachada persistente.
- `89bed55e01dfc9a262ed5aff8930908e9f91c592` — autoridad pública.
- `7ddcb74115b0afb644a0a6fa892d2d11f266b67f` — pruebas adversariales.
- `23f50d9c8644f661316fb59d772cbdfbfde2ff94` — semántica final por ejecución y proyector.

## Quality

- `#994`: falló al detectar tres incompatibilidades semánticas reales en razones de deduplicación, proyectores no soportados y replay.
- `#996`: success técnico final.

## Reauditoría

No se encontraron consumidores normales importando directamente el motor volátil. La API pública utiliza la fachada persistente. La firma versionada evita bloquear nuevas versiones y los fallos parciales no confirman checkpoints.

## Riesgo residual y condición de montaje

El Core define la autoridad durable e hidratable, pero el Projection Engine continúa sin montaje productivo conforme a `AUD-F051`. Al resolver ese hallazgo, el runtime deberá inyectar un backend persistente y compartido por workspace; no se autorizará un store efímero por defecto en producción.
