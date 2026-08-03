# Reauditoría Forense #2 — Bloque A

Fecha: 2026-08-03
Rama: `foundation/event-bus-core`

## Dictamen

La segunda reauditoría independiente reabrió el Bloque A al detectar dos defectos no cubiertos por la certificación anterior. Ambos fueron corregidos y certificados por Quality #588.

## AUD-F067 — Deduplicación dependiente del historial y colisiones de identidad

### Hallazgo

El Event Bus usaba la misma estructura para historial visible y deduplicación. Al recortar `maxHistory`, los identificadores antiguos dejaban de conocerse y podían ejecutarse nuevamente. Con `maxHistory: 0`, la deduplicación quedaba completamente desactivada. Además, Event Bus y Ledger aceptaban silenciosamente un `eventId` existente con contenido distinto.

### Corrección

- La retención del historial quedó separada del registro de eventos completados.
- Desactivar o recortar historial ya no desactiva deduplicación.
- Se conserva una huella del evento completado durante la vida de la instancia.
- Event Bus rechaza colisiones completadas, pendientes y en vuelo.
- Ledger rechaza colisiones en `append`, `appendMany`, `reconcileMany` y `replaceMany`.
- Los lotes continúan siendo atómicos ante una colisión.

### Evidencia

- Event Bus: `cc75606b15303c5ac2956616426424ba6cfae2ea`
- Ledger: `ebc03fb2377b0c557045b80ade8549ba7db234d4`
- Pruebas adversariales: `5e5e38296fb7e88befea5d96904ddc135a9985ec`

## AUD-F068 — Auto-bloqueo por publicación reentrante

### Hallazgo

Un handler que publicaba y esperaba el mismo evento podía recibir la promesa de entrega que lo estaba ejecutando. Esa dependencia circular dejaba la publicación bloqueada indefinidamente.

### Corrección

- El Event Bus contabiliza handlers activos por `eventId`.
- Una republicación originada dentro de un handler activo recibe inmediatamente un resultado duplicado `inFlight`.
- Los consumidores concurrentes externos continúan compartiendo la promesa de ejecución original.
- Se añadió una prueba con límite temporal que falla ante cualquier reaparición del deadlock.

### Evidencia

- Implementación final: `9e7e904bf925ec83324232b4313b8b757f8533c8`
- Prueba de reentrancia: `b69a387b171c0f9d8e61d6ac064d77b5c99e20c1`
- Quality #588: `success`

## Estado

Los dos hallazgos están técnicamente corregidos. El Bloque A permanece sujeto a una tercera auditoría completa antes de recuperar su certificación forense.
