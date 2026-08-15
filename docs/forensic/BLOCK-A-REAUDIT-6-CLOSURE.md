# Bloque A — Reauditoría forense 6

## Dictamen

La auditoría independiente reabrió el Bloque A al detectar dos defectos adicionales en el contrato de datos de eventos. Ambos quedaron corregidos y certificados.

## AUD-F072 — Inmutabilidad aparente de estructuras no JSON

### Hallazgo

`structuredClone()` y `Object.freeze()` aceptaban `Map` y `Set`, pero congelar esas instancias no impide `set()`, `add()`, `delete()` o `clear()`. Un evento podía modificarse después de creado o publicado. También se aceptaban `BigInt`, `undefined`, ciclos y números no finitos, incompatibles o divergentes con la persistencia JSON.

### Corrección

El payload y la metadata aceptan únicamente datos JSON canónicos: objetos planos, arreglos densos, `null`, strings, booleanos y números finitos. La copia es recursiva, independiente de la fuente y congelada en profundidad. Se rechazan estructuras mutables especiales, ciclos y valores no persistibles.

## AUD-F073 — Identidad divergente después de persistencia JSON

### Hallazgo

Arreglos dispersos y `-0` podían cambiar durante `JSON.stringify()`/`JSON.parse()`, haciendo que un evento aceptado no conservara su identidad al rehidratarse. Propiedades Symbol, no enumerables o adicionales en arreglos podían descartarse silenciosamente.

### Corrección

Se rechazan arreglos dispersos y propiedades que JSON descartaría. `-0` se normaliza a `0`. Todo evento aceptado conserva contenido e identidad después de un roundtrip JSON.

## Evidencia

- Contrato JSON inmutable: `2b405a3fb2c1853ac97b157ccadb8c406d80b495`
- Pruebas de estructuras no persistibles: `36a09852c2aa9f3b560933a1d8a3d0559c081d36`
- Normalización de bordes JSON: `c3f5e07588cfb873976533d38e7818b1105fb2e6`
- Pruebas finales: `834fe63de23d61ed5fbe41e104ca9680e016a9b3`
- Quality inicial: `#614` — success
- Quality final: `#618` — success

## Resultado

No se detectaron regresiones en Event Bus, Ledger, bootstrap, sincronización ni persistencia local. El Bloque A queda certificado con los hallazgos AUD-F072 y AUD-F073 cerrados.
