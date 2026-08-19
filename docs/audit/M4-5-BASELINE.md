# M4.5 — Sync / Migración inicial · Baseline forense

## Alcance

- Rama: `audit/v3-m4-5-sync-migration`
- Base apilada: `audit/v3-m4-4-finance`
- Base SHA: `0e11c1155640d57e2b5aa209ff0761ff4213ce0c`
- Superficie: migración inicial, bootstrap autoritativo, sync incremental, cola offline, conflictos, reconciliación multi-dispositivo y Sync Center.
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Con Actions sin cuota, un hallazgo puede quedar `Ready for Quality`, nunca `Verified`.

## F001 — Critical — Ready for Quality

**La migración inicial podía adoptar registros ownerless bajo la empresa seleccionada y considerar migrables arrays locales/sensibles.**

Evidence/RED:
- `tests/sync-migration-tenancy.test.js`
- RED inicial: `8350727f4ad33550e3e972db47ee9491dba9e797`
- Contrato reforzado para rechazar ownership sólo de transporte: `d72921df6403b2562b884eb15ae56522019c7b32`

Remediation:
- migración limitada a `SYNCABLE_COLLECTIONS`: `0dcaaedb0abcf5504fc070c7f4c4161db29380ea`
- validación/confirmación/crypto endurecidos: `c6ef6e4822d7be40fedb93a87bf0eced819f8093`
- ownership final de dominio ignora `_organizationId`: `4845c78036561cb688da43e3fd3fab4d19230cbc`

Semántica final: en multiempresa un registro ownerless o con sólo `_organizationId` no se adopta; en instalación de una sola empresa puede materializarse `organizationId` inequívocamente; foreign records se excluyen y metadata local como `companies/users/roles` no entra en la migración operacional.

## F002 — Critical — Ready for Quality

**El bootstrap remoto validaba el envelope `organization_id`, pero podía aceptar un payload con ownership de otra empresa.**

Evidence/RED:
- `tests/sync-migration-tenancy.test.js`
- RED: `8350727f4ad33550e3e972db47ee9491dba9e797`

Remediation:
- `remoteBootstrap.js`: `e85efcaaaec9848d67f55af0bffbadbcaeafa23f`

El payload remoto ahora falla cerrado si `organizationId/companyId` contradice la organización de la fila; al hidratar, el owner autoritativo se materializa como `organizationId` y `_organizationId`.

## F003 — Critical — Ready for Quality

**La hidratación autoritativa podía eliminar/adoptar estado ownerless o aplicar una mutación ownerless al tenant activo por fallback.**

Evidence/RED:
- `tests/sync-migration-tenancy.test.js`
- RED: `8350727f4ad33550e3e972db47ee9491dba9e797`

Remediation:
- `remoteBootstrap.js`: `e85efcaaaec9848d67f55af0bffbadbcaeafa23f`

Semántica final: ownerless local ambiguo se conserva sin ser adoptado ni eliminado; las mutaciones pendientes sólo se aplican si tienen `companyId` explícito que coincida con el tenant; la hidratación ya no materializa automáticamente `companyId` en entradas legacy de cola.

## F004 — High — Ready for Quality

**El Sync Center calculaba estado global y luego podía mostrar a una empresa el estado/fecha de sincronización de otra.**

Evidence/RED:
- `tests/sync-conflict-tenancy.test.js`
- RED: `c5a7f198905c69b2dc2ff424ff064adf7dbb97a2`
- contrato de timestamp por empresa: `b5fb269f0db1540df3afe69f078f18856c790ba5`

Remediation:
- `syncStatus()` tenant-aware: `2487a6cf0e9c50a2129c01f206eb8cd79ca0abad`
- persistencia `lastSyncedAtByCompany`: `c6c6538878d1c3e95c1a35d0f645892c3c2770fd`
- lectura final por empresa: `5696bca7e4dd945a0eaf784d7d759720c3cfd7e3`

Los contadores y la fecha “Al día” quedan separados por organización; el timestamp global legacy sólo se usa como compatibilidad en instalaciones de una sola empresa.

## F005 — High — Ready for Quality

**Reintentos y resolución de conflictos usaban IDs crudos globales y podían operar sobre homónimos de otro tenant.**

Evidence/RED:
- `tests/sync-conflict-tenancy.test.js`
- RED: `c5a7f198905c69b2dc2ff424ff064adf7dbb97a2`

Remediation:
- `syncConflictCenter.js`: `c25caa863225b07c9aff9c4c6b59d4540e7a1ae8`

La selección usa ID + empresa; duplicados intra-tenant fallan cerrado; ownerless/foreign no se reintentan; una resolución sólo completa la mutación de la misma empresa y el payload combinado recibe `organizationId` explícito.

## F006 — Critical — Ready for Quality

**El sync incremental genérico aún podía usar metadata de transporte como sustituto de ownership de dominio y reemplazar un homónimo ownerless.**

Evidence/RED:
- `tests/sync-generic-ownership.test.js`
- RED: `fe032ff27cbe07ef808986af92415edaa10f1a40`

Remediation:
- generic ownership hardening: `fd37a7d4c8bf4a0d4779204ddf9a80f5946d537f`
- estado final de `syncEngine.js`: `5696bca7e4dd945a0eaf784d7d759720c3cfd7e3`

Semántica final: en multiempresa una mutación outbound exige owner de dominio explícito; `_organizationId` no basta. El pull materializa `organizationId`; un homónimo ownerless ambiguo se preserva y el remoto se incorpora como registro explícitamente tenant-owned. En single-company se mantiene compatibilidad inequívoca.

## F007 — Critical — Ready for Quality

**`pushPending()` filtraba entradas por empresa, pero actualizaba éxito/error/conflicto mediante `item.id===entry.id`, pudiendo cambiar homónimos de otra empresa.**

Evidence/RED:
- `tests/sync-generic-ownership.test.js`
- RED: `fe032ff27cbe07ef808986af92415edaa10f1a40`

Remediation:
- identidad compuesta de cola: `8b658c6922e87f8693448be5e2f1bece445a07c2`
- estado final + timestamp por empresa: `c6c6538878d1c3e95c1a35d0f645892c3c2770fd`

Toda transición de cola usa `companyId + mutationId`. El purge de completadas también queda limitado a la empresa sincronizada.

## F008 — Critical — Ready for Quality

**Backup, preview, ejecución y rollback de la migración inicial no estaban ligados a la misma fotografía, creando un TOCTOU de datos.**

Evidence/RED:
- `tests/initial-migration-toctou.test.js`
- RED: `028cb50d5e923ee0a3f572355a1ecf0694b10270`

Remediation:
- `InitialMigrationPage.jsx`: `97e9570fba84d0dc61e9224bc7b9888e01eb9bfa`

El respaldo fija un `preparedManifest` inmutable; preview y execute usan exactamente esa fotografía; cambiar de empresa invalida el flujo preparado; rollback usa el `companyId/migrationId` exacto de la migración completada, no el manifest vivo.

## F009 — High — Ready for Quality

**Un registro sin ID podía desaparecer antes de validación y el servicio de ejecución aceptaba confirmación/hash débiles.**

Evidence/RED:
- `tests/initial-migration-validation.test.js`
- RED: `bfbd1c3c05cb83c920352a2ff4b486a6528588e6`

Remediation:
- `initialMigration.js`: `c6ef6e4822d7be40fedb93a87bf0eced819f8093`
- ownership final de migración: `4845c78036561cb688da43e3fd3fab4d19230cbc`

Los registros sin identidad llegan al preflight y producen error; ejecutar exige exactamente `MIGRAR` y un SHA-256 de 64 hex; `hashBackup()` requiere WebCrypto SHA-256 y no usa fallback débil. El formato del backup quedó corregido a `nexora-one-initial-migration-backup`.

## Reauditoría final

- Migración inicial: sólo colecciones operacionales sincronizables; ownerless multiempresa y transport-only ownership fallan cerrado.
- Bootstrap: payload remoto contradictorio rechazado; ownership autoritativo materializado en dominio.
- Reconciliación: legacy ambiguo se conserva sin adopción; cola ownerless no se aplica al tenant activo.
- Sync Center: métricas, timestamps, reintentos y conflictos tenant-aware.
- Sync incremental: outbound/pull genérico con ownership explícito en multiempresa.
- Transporte: estados y purge de cola por identidad compuesta `companyId + mutationId`.
- Migración: snapshot inmutable entre backup/preview/execute/rollback y defensa criptográfica de ejecución.
- Rama permanece estrictamente apilada sobre M4.4; `main` no se toca.

**Estado técnico:** 9/9 Ready for Quality.
**Estado certificado:** 0/9 Verified.

## Quality

El PR permanecerá draft para que Quality quede `skipped` antes de asignar runner mientras la cuota gratuita esté agotada. Sólo una ejecución real y completamente verde después del reset puede promover F001–F009 a `Verified`.
