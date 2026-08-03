# Cierre forense AUD-F033

## Hallazgo

Las excepciones producidas por callbacks del adaptador Ledger → Projection Engine podían rechazar permanentemente la promesa usada como cola. Una vez rechazada, las operaciones posteriores enlazadas mediante `queue.then(...)` no se ejecutaban y `flush()` propagaba el rechazo.

## Causa raíz

`onResult()` se ejecutaba dentro del mismo `try` que `engine.execute()`. Si `onResult()` fallaba, el adaptador lo trataba como fallo del motor e invocaba `onError()`. Si `onError()` también fallaba, la función encadenada rechazaba `queue`, envenenando toda la secuencia futura.

## Corrección

- Cada entrada se procesa mediante una unidad `processEntry()` que captura internamente los fallos del motor.
- Los observadores `onResult` y `onError` se ejecutan mediante `safelyNotify()`.
- Los errores de observadores quedan separados de los errores de proyección mediante `callbackFailed` y `lastCallbackError`.
- Se añadió el observador opcional `onCallbackError`, también aislado frente a sus propias excepciones.
- La cola enlaza tanto la rama resuelta como la rechazada a la siguiente entrada, de modo que una promesa histórica rechazada no puede impedir recuperación.
- `pending` se decrementa siempre en `finally`.

## Pruebas directas

- Excepción síncrona de `onResult` sin rechazo de `flush()`.
- Excepción asíncrona de `onError` sin bloqueo de eventos posteriores.
- Excepción del propio `onCallbackError` sin contaminación de la cola.
- Conservación del orden, métricas y retorno de `pending` a cero.

## Evidencia

- Implementación: `fd87af6950da19c157553f16c36e4e693df48401`
- Pruebas: `4b6e67b798f242e60a5b09abb81351318073a0e1`
- Quality técnico: `#984` — success

## Resultado de reauditoría

No se encontró otro adaptador Ledger → Projection Engine con una cadena de promesas paralela. `flush()` queda ligado a una cola que termina resuelta después de cada trabajo, incluso cuando fallan el motor o cualquiera de los observadores.

## Riesgo residual

Los callbacks siguen siendo código externo y pueden fallar, pero esos fallos quedan observables y aislados. No pueden detener el procesamiento posterior ni alterar las métricas de éxito/fallo del motor.
