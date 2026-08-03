# Bloque A — Reauditorías forenses 7 y 8

## Dictamen

La reauditoría 7 reabrió el Bloque A al identificar tres defectos nuevos en el contrato canónico de eventos. Todos fueron corregidos y certificados. La reauditoría independiente 8 se ejecutó posteriormente sobre el estado corregido y no encontró defectos adicionales.

## AUD-F074 — Copia canónica vulnerable a claves de prototipo y propiedades accesoras

La copia de objetos asignaba propiedades mediante `result[key] = value`. Una clave propia `__proto__` podía modificar el prototipo del resultado en vez de conservarse como dato. Además, getters enumerables podían ejecutarse durante la validación y producir efectos secundarios o valores no deterministas.

Corrección:

- Las propiedades se copian mediante `Object.defineProperty` como datos propios.
- Las claves `__proto__` se conservan sin alterar el prototipo.
- Se rechazan propiedades accesoras en objetos y arreglos.
- La validación no ejecuta getters.

## AUD-F075 — Coerción silenciosa de identificadores

Los identificadores requeridos y opcionales se convertían mediante `String(...)`. Objetos, arreglos, números y símbolos podían transformarse silenciosamente en identidades ambiguas.

Corrección:

- Event ID, aggregate type, aggregate ID, organization ID y actor ID deben ser strings reales no vacíos.
- Site ID, correlation ID y causation ID aceptan únicamente strings reales o `null`.
- Se mantiene normalización por `trim()` únicamente sobre texto contractual.

## AUD-F076 — Coerción silenciosa de la fecha del evento

`Date.parse()` podía invocar coerciones de objetos y aceptar valores no textuales como identidad temporal.

Corrección:

- `occurredAt` debe ser texto real no vacío.
- La validación no ejecuta `toString()` de objetos externos.
- La fecha válida se normaliza a ISO 8601.

## Evidencia

- Contrato protegido contra claves de prototipo y accessors: `42db0605246d822db405e474a4f144fb409ea031`
- Pruebas de propiedades hostiles: `eee7d6c9f05551663c347e7733f5b61304bfeb0d`
- Identificadores estrictos: `2f359b396640b2a08ace4298301bb2bb1b8fabf2`
- Pruebas de identidad estricta: `7c8aa2b00aae9bd22d38cc9f0cc19b2360dde0a2`
- Fecha estrictamente textual: `b8e68cf74f67753dfcf85fab600759513f22e343`
- Pruebas temporales: `cb2a35e8a5cc671d19be1dd90eba38d9d6e4ccc5`
- Auditoría independiente A8: `03efac36add02d95e1ab92d5d5548b9558341ab5`

## Quality

- Quality de propiedades hostiles: #624 — success.
- Quality de identidad estricta: #628 — success.
- Quality del contrato temporal: #632 — success.
- Quality de auditoría independiente A8: #634 — success.

## Resultado

La auditoría A8 confirmó nuevamente las invariantes de serialización, deduplicación, concurrencia, reintento, lifecycle, Ledger, bootstrap, sincronización y persistencia. No se encontraron hallazgos adicionales. El Bloque A queda certificado nuevamente.
