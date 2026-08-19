# M4.6 — Observabilidad / Auditoría / Insights / Diagnósticos · Baseline forense

## Alcance

- Rama: `audit/v3-m4-6-observability`
- Base apilada: `audit/v3-m4-5-sync-migration`
- Base SHA: `5b301fc2abf1a58823706b652c0e331b32dba070`
- Superficie inicial: Audit Log, Insights agronómicos, Diagnósticos y caché offline segmentada.
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Actions sin cuota: máximo estado antes de CI real = `Ready for Quality`.

## F001 — Critical — Confirmed

`AuditLogPage` renderiza `state.auditLog` globalmente y resuelve `detail` contra plantas/camas/naves por raw ID. Además las entradas nuevas del reducer no persisten `organizationId`/`siteId`. Con IDs homónimos, la auditoría puede exponer actividad o jerarquía de otra empresa y el histórico nuevo queda sin owner.

Evidence/RED: `tests/observability-tenancy.test.js` @ `311b5528a9829d2096c0fbbb1519d9d243a2c00e`.

## F002 — High — Confirmed

`InsightsPage` correlaciona `houses`, `mirfeMonitoring`, `beds`, `plantPositions` y `findings` desde arrays globales. Las señales agronómicas pueden mezclar datos cross-tenant y producir alertas falsas.

Evidence/RED: `tests/observability-tenancy.test.js` @ `311b5528a9829d2096c0fbbb1519d9d243a2c00e`.

## F003 — Critical — Confirmed

`runDiagnostics(state)` opera sobre el estado global, por lo que IDs legítimamente repetidos entre tenants se reportan como duplicados y relaciones pueden resolverse contra otro tenant. Además `productionOverages` trata `productionLedger` como array aunque desde M4.2/M4.4 el ledger canónico es un objeto por fase, pudiendo romper el diagnóstico de balance de masa.

Evidence/RED: `tests/observability-tenancy.test.js` @ `311b5528a9829d2096c0fbbb1519d9d243a2c00e`.

## F004 — Critical — Confirmed

`compactCompanyState()` incluye registros ownerless mediante `!owner || owner===companyId`, adoptándolos en la caché segmentada de la empresa activa. `auditLog` además se almacena en la identidad global, no en la partición de empresa. El namespace aún usa `cannapa_cache_v2`.

Evidence/RED: `tests/lightweight-cache-tenancy.test.js` @ `a2c6dbf30ecf2cac08761c18b0427012f3ff5009`.

## Quality

El PR se mantendrá draft para que Quality quede `skipped` sin runner. Ningún hallazgo será `Verified` sin ejecución real y verde.
