# Cierre forense — AUD-F015

## Hallazgo

El Timeline conservaba una conexión directa al Event Bus, paralela a la proyección canónica desde Operational Ledger. Además, los errores de suscriptores eran silenciados completamente.

## Corrección

- `connect()` rechaza explícitamente Event Bus → Timeline.
- `recordEvent()` queda deprecado y rechaza escritura directa.
- La salud declara `authority: operational-ledger` y `connected: false`.
- Los errores de observadores no bloquean otros listeners ni escrituras.
- Cada fallo incrementa un contador acumulativo y conserva diagnóstico acotado.
- `onObserverError` permite integración externa sin confiar en que su callback funcione.
- Los diagnósticos retenidos son inmutables.
- `maxObserverErrors` limita crecimiento de memoria.

## Evidencia

- Implementación: `6d5bdfd17ba56d290eb41205aa374d1e1ad1265d`
- Suite heredada alineada: `acdcfb5f9883af655af2339f3a2418e5c532ec77`
- Pruebas directas: `6683995cd69d371ea221886fe455d658607c1056`
- Quality técnico: `#864` — success

## Prueba directa

`tests/block-c-aud-f015-timeline-authority-observability.test.mjs`

Verifica deprecación del camino directo, aislamiento de listeners defectuosos, callback diagnóstico hostil, retención acotada y desuscripción selectiva.

## Resultado de reauditoría

No se encontraron consumidores productivos de `timeline.connect()` ni `recordEvent()`. El bridge productivo continúa proyectando exclusivamente desde Operational Ledger.

## Riesgo residual

La API deprecada permanece temporalmente para producir un error contractual claro. Su eliminación física debe coordinarse con la política general de deprecación de `AUD-F056`.
