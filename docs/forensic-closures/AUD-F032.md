# Cierre forense AUD-F032

## Hallazgo

El Projection Engine implementaba timeout mediante `Promise.race()`. La operación dejaba de esperar al proyector, pero la promesa interna seguía ejecutándose y podía producir efectos después de que el intento hubiera sido registrado como fallido.

## Corrección

Cada intento dispone ahora de un lease de ejecución independiente con:

- `context.signal`: `AbortSignal` abortado al vencer el timeout o fallar el intento.
- `context.assertActive()`: precondición para comprobar que el intento conserva autoridad.
- `context.commit(effect)`: única puerta contractual para confirmar efectos externos mientras el lease continúa activo.

Al vencer el timeout, el motor invalida el lease y aborta la señal antes de devolver el fallo. Un `commit()` tardío se rechaza y no ejecuta el efecto.

Cada retry recibe un `AbortController` nuevo; no reutiliza la señal ni la autoridad del intento anterior.

## Evidencia

- Implementación: `0ae9f5da569046963c7adfa7d67e6f169c4a087d`.
- Pruebas adversariales: `1bf23360f2b47eba6ce3f409efd8342f54b22ce4`.
- Quality técnico: ejecución `#978`, resultado `success`.

## Prueba directa

La suite demuestra que:

1. el timeout aborta la señal antes de entregar el resultado fallido;
2. el evento no queda marcado como procesado;
3. una operación tardía que intenta confirmar mediante `context.commit()` es rechazada;
4. el efecto tardío no modifica el estado externo.

## Resultado de reauditoría

- El Projection Engine continúa sin montaje productivo, conforme a `AUD-F051`.
- No existen proyectores productivos con efectos persistentes fuera del contrato abortable.
- `connectLedgerToProjectionEngine()` únicamente serializa `engine.execute()` y no confirma efectos de proyección.
- Cada intento y retry recibe un lease independiente.

## Riesgo residual y criterio de entrada

JavaScript no puede detener por fuerza una promesa arbitraria que ignore `AbortSignal`. Por ello, todo proyector futuro que use timeout y produzca efectos externos deberá:

- respetar `context.signal` en operaciones cancelables; y
- confirmar cualquier mutación mediante `context.commit()` inmediatamente antes del efecto.

Un proyector que escriba directamente fuera de este contrato no será admisible para montaje productivo. Esta condición deberá verificarse de nuevo al resolver `AUD-F051`.
