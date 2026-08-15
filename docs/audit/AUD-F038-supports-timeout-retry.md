# AUD-F038 — supports() bajo timeout y reintentos

## Estado
Cerrado y certificado.

## Causa raíz
`projector.supports()` se ejecutaba antes de crear el lease del intento. Su duración no consumía el timeout y sus excepciones no seguían `maxAttempts` ni `retryDelayMs`.

## Corrección
`supports()` y `project()` forman ahora una sola unidad por intento. Ambas fases reciben el mismo contexto abortable (`signal`, `assertActive`, `commit`), comparten el mismo presupuesto `timeoutMs` y se repiten juntas ante excepciones o timeout.

Un resultado `supports() === false` permanece como decisión normal `unsupported` y no se reintenta. `project()` no se inicia si la selección vence, falla definitivamente o declara que el evento no está soportado.

## Garantías
- timeout durante supports aborta la señal antes de registrar el fallo;
- excepciones de supports respetan maxAttempts y retryDelayMs;
- cada retry obtiene un lease y AbortSignal nuevos;
- supports y project consumen un único presupuesto temporal;
- commits tardíos quedan invalidados;
- unsupported no marca idempotencia ni crea checkpoints;
- fallos de selección no confirman el checkpoint global de la fachada persistente;
- execute y replay usan el mismo contrato.

## Evidencia
- Implementación: `15187ff9d95215a1a0021d5f33ae13783f459a8a`
- Pruebas adversariales: `fda33734f80d9c6d2c3caaeea345fea443571cef`
- Quality técnico: `#1034` success

## Reauditoría
No se encontraron llamadas productivas a `supports()` fuera de `runProjector()`. La fachada persistente confirma checkpoints únicamente después de una ejecución completa sin estados failed o blocked; por tanto, un fallo de selección libera el claim y conserva la posibilidad de reintento.
