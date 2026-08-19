# M4.5 — Sync / Migración inicial · Baseline forense

## Alcance

- Rama: `audit/v3-m4-5-sync-migration`
- Base apilada: `audit/v3-m4-4-finance`
- Base SHA: `0e11c1155640d57e2b5aa209ff0761ff4213ce0c`
- Superficie inicial: `initialMigration.js`, `remoteBootstrap.js`, Sync Center y reconciliación multi-dispositivo.
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Actions sigue sin cuota: máximo estado permitido antes de CI real = `Ready for Quality`.

## F001 — Critical — Confirmed

**La migración inicial adopta registros ownerless como pertenecientes a la empresa seleccionada y considera migrables arrays locales/sensibles.**

`migratableCollections()` toma casi cualquier array salvo una lista corta. `buildMigrationManifest()` considera elegible cualquier registro con `!owner || owner===companyId`, por lo que datos ownerless en multiempresa pueden ser re-etiquetados con `organization_id` del tenant activo. `companies`, `users` y `roles` tampoco están excluidos por diseño.

Impacto: contaminación cross-tenant durante la primera migración y migración accidental de metadata local que no pertenece al estado operacional remoto.

## F002 — Critical — Confirmed

**El bootstrap remoto valida el envelope `organization_id`, pero no contradicciones de ownership dentro del payload.**

`groupRemoteRecords()` puede recibir una fila `organization_id=org-a` cuyo `payload.organizationId=org-b`; luego agrega `_organizationId=org-a`. Como distintas capas priorizan campos de ownership de manera diferente, el estado hidratado puede contener ownership contradictorio.

## F003 — Critical — Confirmed

**La hidratación autoritativa adopta o elimina estado ownerless por fallback al tenant activo.**

- `replaceCompanyPartition()` descarta ownerless local al reemplazar la partición.
- `recordKey(record, fallbackCompanyId)` trata ownerless como si perteneciera al fallback.
- `overlayPendingMutations()` usa `item.companyId || companyId`, adoptando mutaciones legacy sin tenant.
- al final, `syncQueue` materializa `companyId` en entradas que antes no lo tenían.

Impacto: pérdida silenciosa de legacy ambiguo o aplicación de una mutación al tenant equivocado durante bootstrap.

## Evidence / RED

- `tests/sync-migration-tenancy.test.js`
- Commit RED: `8350727f4ad33550e3e972db47ee9491dba9e797`

## Quality

El PR permanecerá draft. Ningún hallazgo será `Verified` hasta una ejecución real y verde de Quality después del reset de cuota.
