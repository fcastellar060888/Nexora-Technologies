# Cierre forense — AUD-F048

## Hallazgo

**AUD-F048 — Runtime multiempresa:** Event Bus, Operational Ledger y Timeline eran singletons de módulo. Sus historiales, índices, deduplicación y suscripciones sobrevivían a cambios de empresa o usuario.

## Corrección

- Event Bus, Ledger y Timeline se resuelven mediante registros particionados por `organizationId + actorId`.
- La publicación de eventos utiliza el runtime correspondiente al tenant y actor del evento.
- Operational Ledger Bridge, Timeline Bridge y Audit Bridge resuelven el workspace activo.
- Los efectos React desmontan suscripciones anteriores al cambiar empresa o usuario.
- La reconciliación del Store modifica únicamente la partición activa y preserva otros tenants.
- Se mantienen fachadas locales heredadas para instalación local, pero las rutas productivas no dependen de ellas.
- Cada scope puede liberarse sin afectar a los demás.

## Evidencia

- Event Bus por scope: `9d71d0cc35b033b7ddb5b12e223127b2209ef036`
- Publicación por scope: `b011b93f0c8beccce79ed5e09a696506bc467f0c`
- Ledger por scope: `0f9f70d8a8ea1a74bac3174cea76498563dd89e2`
- Timeline por scope: `db004f81454d90093e9eb63788fe4e9744147e5e`
- Ledger Bridge: `37dd242efe58ce107ddae23ad99424b9231b7490`
- Timeline Bridge: `e9e5edb8899092784821583bb019ed6a6e152e5b`
- Audit Bridge: `5640c9f6071d8355e9c32fba751e7d85e44dc952`
- Pruebas directas de aislamiento: `8cc9e423281e5e83120406f849932e02dec65faf`
- Contratos de pruebas actualizados: `e0d5b50dede3c191f3973606b3833ec4a105d1fb`, `f0d99566bda1f30f9152fed90cf818b3dd832d9d`

## Quality

- `#798`: detectó dos pruebas heredadas acopladas a nombres de singleton.
- `#806`: **success** sobre la implementación completa, incluyendo el Audit Bridge residual.

## Reauditoría independiente

Se verificó aislamiento entre dos empresas y dos usuarios, secuencias independientes, ausencia de entregas cruzadas, Timeline separado y liberación selectiva de scopes. La revisión posterior encontró y corrigió el uso residual del Ledger global en auditoría.

## Dictamen

`AUD-F048` queda **cerrado y certificado**.
