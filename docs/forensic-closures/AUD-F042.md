# Cierre forense AUD-F042

## Hallazgo

La hidratación remota de PostgreSQL se construía con el snapshot local capturado antes de iniciar la solicitud. Si el usuario modificaba datos mientras la respuesta estaba en tránsito, el resultado remoto podía reemplazar esos cambios locales concurrentes.

## Corrección

- `bootstrapOrganization()` conserva el estado inicial únicamente como base de comparación.
- Al recibir la respuesta, obtiene el estado vigente mediante `getCurrentState()`.
- `overlayConcurrentChanges()` calcula el delta entre el estado inicial y el vigente por colección e identidad estable.
- Altas, modificaciones y eliminaciones locales realizadas durante la solicitud se superponen al snapshot remoto.
- Las mutaciones pendientes de sincronización continúan aplicándose después del delta concurrente.
- Si la empresa activa cambia durante la solicitud, el resultado se descarta con `stale-company-context`.
- `StoreProvider` entrega explícitamente `stateRef.current` al finalizar la solicitud, evitando confirmar un snapshot capturado previamente.

## Evidencia

Hallazgo: `AUD-F042`

Commits:
- `936df101195d62b06d319bb8243e79bcc2b65d63` — reconciliación de cambios concurrentes.
- `1b9b951cc7923b231210e498f0d63fe69cee54ce` — integración del Store con lector de estado vigente.
- `31696e46e989d1f83c1b19dd6d21c635640d1244` — pruebas directas de concurrencia.

Quality: workflow `Quality #544`, resultado `success`.

Prueba directa:
- actualización local concurrente sobre el mismo registro;
- alta local concurrente;
- eliminación local concurrente;
- conservación del remoto cuando el registro no cambió localmente;
- hidratación completa con metadatos;
- verificación de que el Store usa `getCurrentState`.

Resultado de reauditoría: la respuesta remota ya no puede confirmar un estado anterior al vigente. El commit de hidratación parte del Store actual y aplica de forma explícita el delta ocurrido durante la operación.

Riesgo residual: la reconciliación se basa en identidad `id` y comparación estructural JSON. Los conflictos remotos simultáneos posteriores pertenecen al flujo de sincronización y se tratarán en `AUD-F043`; no bloquean el cierre de este hallazgo.
