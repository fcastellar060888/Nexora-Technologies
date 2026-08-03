# Cierre forense AUD-F019

## Hallazgo

Las unidades de material vegetal materializadas virtualmente conservaban `updatedAt` igual a su fecha de creación. Cuando el lote fuente se modificaba después, la proyección incorporaba datos actuales del lote pero mantenía una versión temporal antigua, rompiendo trazabilidad y freshness del Passport.

## Causa raíz

`normalizeUnit()` resolvía la fecha con esta precedencia:

```text
unit.updatedAt -> unit.createdAt -> lot.updatedAt -> lot.createdAt
```

Como toda unidad virtual tenía `unit.updatedAt`, `lot.updatedAt` nunca podía propagarse.

## Corrección

- Se separó la autoridad de creación de la autoridad de actualización.
- `createdAt` conserva la primera evidencia válida en orden contractual: unidad, creación del lote o inicio de ciclo.
- `updatedAt` se calcula como el timestamp válido más reciente entre unidad y lote.
- Fechas inválidas no desplazan evidencia temporal válida.
- El Passport de material vegetal recibe la versión temporal efectiva y deriva de ella `generatedAt`.

## Prueba directa

Archivo: `tests/block-b-aud-f019-material-unit-updated-at.test.mjs`

Cobertura:

1. unidad virtual hereda una actualización posterior del lote;
2. actualización individual más reciente conserva autoridad;
3. una fecha antigua de unidad no oculta una modificación nueva del lote;
4. el Passport refleja `updatedAt` y `generatedAt` efectivos;
5. fechas inválidas no desplazan evidencia válida.

## Evidencia

- Corrección inicial: `0f63a002ae7a1d2b429afb1f5d46c2267240ed25`
- Preservación explícita de `createdAt`: `998bae37c350efc2d32253eeedd02180c2d0d9c5`
- Pruebas directas: `64b59cfbe31821dc2c1dc05843f8dee724a96885`
- Quality técnico: workflow `#722`, resultado `success`.

## Resultado de reauditoría

- Las acciones individuales generan su propio `updatedAt` y conservan precedencia cuando son posteriores al lote.
- Las unidades virtuales y las unidades históricas reciben correctamente cambios posteriores del lote.
- No se modificó identidad, índice, lote, ni fecha de creación de la vida materializada.
- No se encontró una segunda ruta de proyección con reglas temporales divergentes.

## Riesgo residual

Bajo. El modelo conserva timestamps inválidos originales fuera de la selección temporal, pero estos no pueden desplazar fechas válidas. Una futura validación de entrada puede rechazar o reportar esos datos corruptos de manera explícita.

## Dictamen

`AUD-F019` queda **cerrado y certificado**, sujeto a Quality verde del commit documental final.
