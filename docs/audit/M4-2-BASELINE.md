# M4.2 — Postharvest / Production Flow · Baseline forense

## Alcance

- Rama: `audit/v3-m4-2-postharvest`
- Base apilada: `audit/v3-m4-1-inventory`
- Base SHA: `a2652302ecab3441b2810a3bf2329e21de0baeb3`
- Superficie inicial: `production.js`, Production, Drying, Trimming, Selection, Packing, Finished Goods y flujo de trazabilidad postcosecha.
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Durante el agotamiento de minutos de GitHub Actions, los hallazgos pueden llegar a `Ready for Quality`, pero no a `Verified`.

## F001 — Critical — Ready for Quality

**El avance de fase de un lote productivo usaba identidad global por `lotId` y podía mutar lotes homónimos de otros tenants.**

### Evidencia en el SHA base

En `src/domain/production.js`:

1. `advanceProductionLot()` resolvía el lote con `find(x => x.id === input.lotId)` sobre `propagationBatches` global.
2. No existía validación autoritativa de `organizationId` ni de la sede antes del avance.
3. La actualización usaba `map(x => x.id === lot.id ? ... : x)`, por lo que todos los homónimos por ID podían recibir la fase/ledger calculados desde un único candidato.
4. El `lotEvent` creado no persistía `organizationId` ni `siteId` como ownership/trazabilidad de primera clase.

Impacto: corrupción cross-tenant de fase productiva, pesos de postcosecha, pérdidas, rendimiento y trazabilidad histórica.

### Evidencia adversarial

- Test: `tests/postharvest-tenancy.test.js`
- RED/evidence: `3a1d7d4b8abaa85c23d6c78ad204d36d999687cc`

### Remediation

Commit: `a4e15be6c926503bffe70cf1a10ec94c0dd3e5f2`

- autoridad derivada de `activeOrganizationId(state)`;
- resolución tenant-aware del lote productivo;
- ownership foreign/ambiguo y `siteId` contradictorio fallan cerrado;
- mutación de un único índice autorizado;
- `organizationId`, `siteId` y `lotId` explícitos en el evento de fase.

### Verificación focal

**3/3 pass, 0 fail**.

**Estado:** Ready for Quality. No Verified.

## F002 — High — Ready for Quality

**El ingreso de Empaque a Finished Goods resolvía lotes, masa disponible y clasificación sobre colecciones globales por raw `lotId`.**

### Evidencia

Antes del remediation:

1. `receiveFinishedGoods()` seleccionaba `propagationBatches` con `find(x => x.id === input.lotId)` sin tenant scope.
2. `packedAvailableGrams()` seleccionaba el lote por raw ID y restaba todos los `finishedGoods` con ese `lotId`, incluso de otros tenants.
3. La unicidad de `classification` se comprobaba globalmente por `lotId + classification`.
4. El finished good y su movimiento no materializaban obligatoriamente `organizationId` + `siteId` como ownership de dominio.

Impacto: un tenant podía perder masa disponible por receipts de otra organización, recibir desde el lote homónimo equivocado o sufrir falsos conflictos de clasificación; además la trazabilidad Finished Goods quedaba sin tenancy explícita.

### Evidencia adversarial

- Test: `tests/postharvest-finished-goods-tenancy.test.js`
- RED/evidence: `72ae6b3e5feffdc60f053b5cc11a61abb4432f81`

Casos cubiertos:

- masa disponible calculada exclusivamente desde el lote del tenant activo y sus propios receipts;
- clasificación homónima en otra empresa no bloquea el ingreso legítimo;
- lote empacado foreign-only rechazado;
- identidad duplicada dentro del tenant activo rechazada;
- conservación de masa tenant-aware: no se puede superar el output de Empaque restante;
- caller no puede suplantar `organizationId` ni `siteId`;
- finished good y movimiento persisten `organizationId`, `siteId` y `lotId` explícitos.

### Remediation

Commit: `f3e488213a4ee2a2aa33f8021cdb11c1de6c2c28`

- `packedAvailableGrams()` deriva la empresa activa y resuelve el lote con el mismo boundary tenant-aware de F001;
- receipts extranjeros explícitos quedan fuera del cálculo de masa del tenant activo;
- finished goods legacy ownerless/ambiguos en multiempresa fallan cerrado en vez de ser adoptados;
- `receiveFinishedGoods()` valida anti-spoof de empresa y sede;
- unicidad de clasificación se vuelve tenant-local;
- item y movimiento de Finished Goods reciben ownership explícito;
- la conservación de masa se calcula únicamente contra receipts autorizados del tenant activo.

### Verificación focal

Se ejecutaron las seis garantías adversariales de F002 sobre la lógica publicada: **6/6 pass, 0 fail**.

**Estado:** Ready for Quality. No Verified.

## F003 — Under investigation

Las páginas de Secado, Manicura, Selección, Empaque, Finished Goods y Production Flow deben reauditarse por exposición cross-tenant en lectura/selectores y lookups por raw ID.

## F004 — Under investigation

Se auditará conservación de masa y causalidad entre fases: Cosecha → Secado → Manicura → Selección → Empaque → Finished Goods, incluyendo idempotencia/replay y prevención de doble ingreso.

## Quality

Los 2.000 minutos incluidos de GitHub Actions están consumidos en el ciclo actual. El workflow ya fue optimizado para que los PR draft terminen `skipped` antes de asignar runner; Quality #2433 confirmó ese comportamiento. La certificación completa se ejecutará cuando exista cuota disponible y el PR se marque Ready.
