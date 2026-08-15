# AUD-F013 — Reconciliación de duplicados del Timeline

## Hallazgo
Un `eventId` ya presente era descartado sin evaluar si la nueva entrada aportaba evidencia más autoritativa o contenido enriquecido.

## Corrección
- Se definió autoridad explícita: `operational-ledger` prevalece sobre `event-bus`.
- Una entrada canónica puede promover y enriquecer una entrada directa previa.
- Una fuente inferior nunca degrada evidencia del Ledger.
- Versiones inferiores de la misma fuente no sustituyen versiones superiores.
- Contradicciones en identidad canónica se rechazan.
- `hydrate()` reconcilia duplicados antes de hacer commit, preservando atomicidad.

## Evidencia
- Implementación: `edf46cec66f5cecd96f22b0e8fbad326cef8574a`
- Pruebas directas: `7d21235582c71625c17c67fdd39f3606c05c6ba8`
- Quality técnico: `#850` — success.

## Prueba directa
Cubre promoción Event Bus → Ledger, no degradación, enriquecimiento de la misma fuente, contradicciones de identidad y atomicidad de hidratación.

## Resultado de reauditoría
Sin rutas residuales para descartar enriquecimiento autoritativo, degradar evidencia canónica o aplicar parcialmente un lote contradictorio.

## Riesgo residual
La ruta directa del Event Bus continúa como compatibilidad identificada y será retirada o deprecada en `AUD-F015`.
