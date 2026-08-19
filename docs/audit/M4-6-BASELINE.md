# M4.6 — Observabilidad / Auditoría / Insights / Diagnósticos · Baseline forense

## Alcance

- Rama: `audit/v3-m4-6-observability`
- Base apilada: `audit/v3-m4-5-sync-migration`
- Base SHA: `5b301fc2abf1a58823706b652c0e331b32dba070`
- Superficie: Audit Log, Operational Ledger, Insights agronómicos, Diagnósticos y caché offline segmentada.
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Actions sin cuota: máximo estado antes de CI real = `Ready for Quality`.

## F001 — Critical — Ready for Quality

**Auditoría leía actividad y jerarquía globalmente y los writes genéricos nacían sin tenant/sede.**

Evidence/RED:
- `tests/observability-tenancy.test.js`
- RED: `311b5528a9829d2096c0fbbb1519d9d243a2c00e`

Remediation:
- `src/domain/observability.js`: boundary tenant-aware común.
- `src/pages/AuditLogPage.jsx`: sólo consume trail/joins de la empresa activa.
- `src/services/store.jsx`: cada auditoría genérica nueva persiste `organizationId` y `siteId`.

IDs homónimos de planta/cama/nave entre empresas ya no cruzan la resolución de detalle; legacy ownerless multiempresa queda fuera del trail hasta tener ownership inequívoco.

## F002 — High — Ready for Quality

**Insights correlacionaba naves, MIRFE, camas, plantas y hallazgos globalmente.**

Evidence/RED:
- `tests/observability-tenancy.test.js`
- RED: `311b5528a9829d2096c0fbbb1519d9d243a2c00e`

Remediation:
- `src/pages/InsightsPage.jsx` consume `observabilityViewForActiveOrganization()`.

Las señales agronómicas se calculan después del scoping; humedad, drenaje, VPD y hallazgos de otro tenant no participan en los KPIs o alertas de la empresa activa.

## F003 — Critical — Ready for Quality

**Diagnósticos operaba sobre el estado global y el chequeo de masa trataba el `productionLedger` canónico como array.**

Evidence/RED:
- `tests/observability-tenancy.test.js`
- RED: `311b5528a9829d2096c0fbbb1519d9d243a2c00e`

Remediation:
- `diagnosticStateForActiveOrganization()` proyecta un estado diagnóstico tenant-scoped.
- `SystemDiagnosticsPage` ejecuta `runDiagnostics()` sólo sobre esa proyección.
- `diagnostics.js` recorre `Object.values(productionLedger)` y conserva el ledger por fase definido en M4.2/M4.4.

IDs repetidos legítimos entre empresas ya no generan falsos duplicados ni relaciones cross-tenant.

## F004 — Critical — Ready for Quality

**La caché segmentada adoptaba ownerless dentro de la empresa activa y guardaba `auditLog` como identidad global.**

Evidence/RED:
- `tests/lightweight-cache-tenancy.test.js`
- RED: `a2c6dbf30ecf2cac08761c18b0427012f3ff5009`

Remediation:
- namespace activo: `nexora_cache_v3`.
- `compactCompanyState()` usa el mismo resolver fail-closed de ownership.
- `auditLog` deja la identidad global y pasa a la partición de empresa.
- single-company mantiene compatibilidad con legacy inequívoco.
- `SystemDiagnosticsPage` sólo muestra/limpia caché de la empresa activa.

## F005 — Critical — Ready for Quality

**La auditoría genérica del reducer era local-only aunque la pantalla la presentaba junto con evidencia durable del Operational Ledger.**

Evidence/RED:
- `tests/audit-durability.test.js`

Remediation:
- `auditLog` entra en `SYNCABLE_COLLECTIONS`.
- es `append-only` y exige `organizationId` de primera clase.
- `store.jsx` crea la entrada antes de calcular su diff y la encola por el boundary durable, incluso cuando el cambio de negocio usa `sync:false`.
- `remoteBootstrap.js` deja de clasificar/restaurar `auditLog` como local-only y carga la partición autoritativa del tenant.
- tombstones remotos de `auditLog` se rechazan.

Los eventos de dominio continúan usando Operational Ledger; el audit genérico sincronizado cubre las actualizaciones no eventizadas sin duplicar la autoridad del ledger.

## F006 — High — Ready for Quality

**La vista de Auditoría dependía del timing de `DomainEventAuditBridge`: un bootstrap podía reemplazar `auditLog` y dejar fuera eventos del ledger hasta que el efecto volviera a ejecutarse.**

Evidence/RED:
- `tests/audit-ledger-projection.test.js`

Remediation:
- `observabilityViewForActiveOrganization()` incluye `operationalLedgerEntries` scoped por `event.context.organizationId`.
- `core/audit/domainEventAudit.js` expone `auditTrailForActiveOrganization()`.
- el trail efectivo combina audit genérico + Operational Ledger, deduplica por ID y da precedencia al ledger.
- `AuditLogPage` consume directamente ese trail y muestra la fuente de evidencia.

La pantalla ya no depende de que el bridge haya materializado previamente cada evento en `auditLog`.

## F007 — High — Ready for Quality

**Las antiguas claves `cannapa_cache_v2:*` podían permanecer indefinidamente en el navegador con el viejo `auditLog` global y otras particiones inseguras.**

Evidence/RED:
- `tests/lightweight-cache-legacy-cleanup.test.js`

Remediation:
- `purgeLegacyLightweightCache()` elimina sólo los namespaces segmentados inseguros `cannapa_cache_v2:*` / `canapa_cache_v2:*`.
- `loadState()` ejecuta el purge antes de leer la nueva caché.
- se preserva `cannapa_device_id` para no rotar la identidad de sincronización del dispositivo.
- se preservan las claves de recuperación de estado legacy; este saneamiento no destruye backups forenses.

## Reauditoría final

- Audit Log: tenant-scoped y compuesto desde fuentes durables explícitas.
- Auditoría genérica: append-only, sincronizable y first-class tenant-owned.
- Operational Ledger: se proyecta directamente en la vista, sin dependencia de timing del bridge.
- Insights: correlaciones tenant-locales.
- Diagnósticos: estado scoped y ledger de masa como objeto canónico.
- Caché: `auditLog` particionado por empresa, ownerless multiempresa excluido y namespace inseguro legado purgado.
- La rama permanece estrictamente apilada sobre M4.5; `main` no se toca.

**Estado técnico:** 7/7 Ready for Quality.
**Estado certificado:** 0/7 Verified.

## Quality

El PR permanecerá draft para que Quality quede `skipped` antes de asignar runner mientras la cuota gratuita esté agotada. Sólo una ejecución real y completamente verde después del reset puede promover F001–F007 a `Verified`.
