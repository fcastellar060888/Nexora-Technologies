# Cierre forense — AUD-F011

## Hallazgo

**AUD-F011 — Timeline:** el bridge mezclaba `timelineEntries` heredadas con proyecciones del Operational Ledger y las trataba como si tuvieran la misma autoridad. Una entrada sin fuente explícita podía permanecer, desplazar o contradecir la proyección canónica.

## Corrección

- `DomainEventTimelineBridge` reconstruye el Timeline exclusivamente desde `operationalLedgerEntries` del workspace activo.
- Las entradas persistidas del tenant se sustituyen por la proyección canónica resultante.
- `domainEventToTimelineEntry()` declara `source` explícita.
- Las proyecciones con secuencia o `recordedAt` usan `operational-ledger`.
- La compatibilidad directa usa `event-bus` y queda diferenciada de la evidencia canónica.
- Fuentes desconocidas se rechazan.

## Evidencia

- Fuente explícita: `9d8cab7cb8e4979a142fef2910eabcfdbdf3be14`
- Bridge puro desde Ledger: `9ab3660e8d77f8023b68846614d7b8d92e67a75a`
- Pruebas directas: `df0fed4bec5abf3f0baebd2b4a2d04dbace69261`

## Quality

- `#830`: **success**; auditoría estática, suite completa y build de producción en verde.

## Reauditoría independiente

Se verificó que el bridge no conserve mapas o mezclas de historial heredado, que toda entrada proyectada declare fuente canónica y que el estado persistido del tenant sea reemplazado por la proyección del Ledger. No quedó una ruta que permita a una entrada sin fuente incorporarse al Timeline canónico.

## Riesgo residual

La ruta directa desde Event Bus permanece únicamente como compatibilidad explícitamente etiquetada y será tratada en `AUD-F015`. No participa en la hidratación productiva del Timeline.

## Dictamen

`AUD-F011` queda **cerrado y certificado**.
