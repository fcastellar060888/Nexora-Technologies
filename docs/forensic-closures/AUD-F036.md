# Cierre forense AUD-F036

## Hallazgo

`executionId` se construía con `history.length + 1`. Al aplicar `historyLimit`, el historial se recortaba y su longitud podía volver a valores anteriores, permitiendo reutilizar identificadores de ejecuciones ya emitidas.

## Causa raíz

La identidad de auditoría dependía de una colección sujeta a retención. El tamaño retenido no representa el número total de ejecuciones ocurridas durante la vida del motor.

## Corrección

Se introdujo `executionSequence`, un contador monotónico independiente del historial retenido.

- Cada registro incrementa la secuencia exactamente una vez.
- `executionId` utiliza la secuencia acumulada, no `history.length`.
- `execute()` y `replay()` comparten el mismo espacio de identidades.
- Varios proyectores del mismo evento reciben identidades distintas.
- `snapshot()` expone `executionSequence` para diagnóstico.
- La fachada persistente conserva el snapshot del motor y no recalcula la identidad.

## Pruebas directas

Archivo: `tests/block-d-aud-f036-execution-id-retention.test.mjs`

1. Cinco ejecuciones con `historyLimit: 2` producen secuencias 1–5 sin reutilización.
2. `execute()` y `replay()` continúan una única secuencia aun con `historyLimit: 1`.
3. Dos proyectores del mismo evento reciben secuencias distintas aunque solo quede una entrada retenida.

## Evidencia

- Corrección inicial: `429c2f2f90745c80a32f8076b254871b4f77da65`
- Pruebas adversariales: `6b504de26e7f9205f46169f1187f17e8bd4ea91a`
- Compatibilidad contractual final: `a009603249e07f50c8d220b6488df92c9e5b2ab4`
- Quality técnico final: `#1010` — success

## Resultado de reauditoría

- No existe otra generación de `executionId` basada en `history.length` o en colecciones recortables.
- La fachada persistente propaga el snapshot base y únicamente agrega checkpoints.
- La retención elimina evidencia antigua sin reducir ni reiniciar el contador acumulado.
- Las garantías de retiro seguro de proyectores, timeout abortable e idempotencia persistente permanecen vigentes.

## Riesgo residual

La secuencia es monotónica durante la vida de una instancia del motor. El Projection Engine continúa sin montaje productivo por `AUD-F051`; al definir su runtime y persistencia productiva deberá decidirse si la secuencia de auditoría también se hidrata entre reinicios. Este punto no reabre el defecto corregido —reutilización causada por retención dentro de la instancia— y queda ligado al contrato de runtime productivo.
