# M4.2 — Postharvest / Production Flow · Baseline forense

## Alcance

- Rama: `audit/v3-m4-2-postharvest`
- Base apilada: `audit/v3-m4-1-inventory`
- Base SHA: `a2652302ecab3441b2810a3bf2329e21de0baeb3`
- Superficie inicial: `production.js`, Production, Drying, Trimming, Selection, Packing, Finished Goods y flujo de trazabilidad postcosecha.
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Durante el agotamiento de minutos de GitHub Actions, los hallazgos pueden llegar a `Ready for Quality`, pero no a `Verified`.

## F001 — Critical — Confirmed

**El avance de fase de un lote productivo usa identidad global por `lotId` y puede mutar lotes homónimos de otros tenants.**

### Evidencia en el SHA base

En `src/domain/production.js`:

1. `advanceProductionLot()` resuelve el lote con `find(x => x.id === input.lotId)` sobre `propagationBatches` global.
2. No existe validación autoritativa de `organizationId` ni de la sede antes del avance.
3. La actualización usa `map(x => x.id === lot.id ? ... : x)`, por lo que todos los homónimos por ID reciben la fase/ledger calculados desde un único candidato.
4. El `lotEvent` creado no persiste `organizationId` ni `siteId` como ownership/trazabilidad de primera clase.

Impacto: corrupción cross-tenant de fase productiva, pesos de postcosecha, pérdidas, rendimiento y trazabilidad histórica.

### Evidencia adversarial

- Test: `tests/postharvest-tenancy.test.js`
- RED/evidence: `3a1d7d4b8abaa85c23d6c78ad204d36d999687cc`

Casos exigidos:

- mismo `lotId` en dos organizaciones con el lote extranjero primero en el array;
- lote existente únicamente en otra organización;
- identidad duplicada dentro del tenant activo;
- evento de fase con `organizationId`, `siteId` y `lotId` explícitos.

**Estado:** Confirmed. Pendiente remediation.

## F002 — Under investigation

`receiveFinishedGoods()` también resuelve `propagationBatches` por raw `lotId` y calcula disponibilidad/duplicados sobre colecciones globales. Debe verificarse aislamiento tenant-aware y conservación de masa entre `Empaque` → `finishedGoods`.

## F003 — Under investigation

Las páginas de Secado, Manicura, Selección, Empaque, Finished Goods y Production Flow deben reauditarse por exposición cross-tenant en lectura/selectores y lookups por raw ID.

## F004 — Under investigation

Se auditará conservación de masa y causalidad entre fases: Cosecha → Secado → Manicura → Selección → Empaque → Finished Goods, incluyendo idempotencia/replay y prevención de doble ingreso.

## Quality

GitHub Actions tiene los 2.000 minutos incluidos consumidos en el ciclo actual. `Quality` fue optimizado para no asignar runner en PRs draft; la certificación completa se ejecutará cuando el PR se marque Ready y exista cuota disponible.
