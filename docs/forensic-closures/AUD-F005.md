# Cierre forense AUD-F005 — Reintento seguro del Event Bus

## Hallazgo

El Event Bus deduplicaba un `eventId` antes de confirmar que todos los suscriptores hubieran procesado el evento. Un fallo parcial podía impedir un reintento posterior y dejar consumidores críticos, como el Operational Ledger, sin recibir el evento.

## Solución certificada

La implementación vigente en `src/core/events/eventBus.js`:

- registra un evento como completado únicamente después de que todos los suscriptores pendientes terminan correctamente;
- conserva por `eventId` el evento y únicamente los handlers que fallaron;
- reintenta solo los handlers fallidos, sin duplicar efectos en los que ya procesaron correctamente;
- comparte una única promesa para publicaciones concurrentes del mismo `eventId`;
- rechaza reutilizar un `eventId` pendiente con contenido diferente;
- aísla fallos de `onError` para que la telemetría no altere la entrega ni el reintento;
- expone `getPendingFailures()` para observabilidad del estado pendiente.

## Prueba directa

`tests/eventBus.test.mjs` certifica:

1. reintento selectivo de un suscriptor transitoriamente fallido;
2. ausencia de doble ejecución del suscriptor que ya tuvo éxito;
3. historial y deduplicación únicamente después de entrega completa;
4. coalescencia de publicaciones concurrentes del mismo evento;
5. rechazo de colisiones de contenido para un `eventId` pendiente;
6. aislamiento ante una excepción de la telemetría de errores.

## Evidencia

- Commit de implementación vigente: anterior al commit de certificación y contenido en el `HEAD` de la rama.
- Commit de pruebas: `d4c91ee30f3dfc8d3cb292c2faa64b792e3598e5` — `test(events): certify selective retry and concurrent deduplication`.
- Workflow: `Quality` run `#528`.
- Resultado: `success`.

## Resultado de reauditoría

**Cerrado.** El evento no entra en la ventana de deduplicación hasta completar todos los handlers. Los fallos parciales permanecen observables y reintentables, y la concurrencia no genera entregas duplicadas dentro de la instancia del bus.

## Riesgo residual

El estado de entregas pendientes permanece en memoria. Un reinicio del proceso pierde ese estado; la durabilidad distribuida de entregas corresponde a una capacidad futura y no forma parte de este saneamiento incremental.
