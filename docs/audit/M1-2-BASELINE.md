# Nexora One — Auditoría Forense v3 · M1.2 Core Shared Services & Governance

Estado: **BASELINE — auditoría abierta**
Base certificada: M1.1 Core Operations, head `9b3964313fb2f2b24bc0b4489b6e1e16342986cb`, Quality #1592 verde.
Arquitectura: AH-001 — M1 Core Platform Ready exige Tenant, Organization/Sites, IAM, Audit, Workflow, Documents, Units, Time, Rules y Entitlements.
Método: Audit → Fix → Test → Quality Gate → Re-Audit → Close.

## Alcance

M1.2 audita los servicios transversales que deben gobernar el resto del producto antes de avanzar a M2:

- Identity & Access / memberships / roles / authorization
- Audit y actor attribution
- Workflow / shared rules
- Documents / attachments
- Units y Time
- Entitlements
- fronteras de tenancy, persistence y command/event audit asociadas

## Hallazgos iniciales reproducibles

| ID | Sev. | Estado | Área | Hallazgo |
|---|---:|---|---|---|
| M12-F001 | P0 | Open | IAM / authorization | Existen dos autoridades de permisos. `domain/accessControl.js` resuelve membership por organization/site con overrides/denials, mientras `services/permissions.js` autoriza por rol local global sin company/site. La UI productiva usa esta segunda ruta. |
| M12-F002 | P0 | Open | Identity / tenancy | `UsersPage` administra perfiles locales como si fueran identidad operativa: selección de `activeSession`, ownership con fallback hasta `local-installation`, mutación directa y eliminación física. Esta autoridad puede divergir de Supabase/memberships empresariales. |
| M12-F003 | P0 | Open | Documents / tenancy | `AttachmentUploader` persiste attachments sin `organizationId` ni `siteId` y los consulta solo por `(entityType, entityId)`. IDs históricos repetidos entre tenants pueden mezclar documentos. |
| M12-F004 | P1 | Open | Documents / persistence/security | Archivos se cargan completos como `dataUrl` mediante `FileReader` al Store, sin autoridad de storage, size limit contractual, content validation, checksum, lifecycle documental ni evento de dominio canónico. |
| M12-F005 | P1 | Open | Time | Utilidades de lifecycle mezclan `Date`, UTC (`toISOString`) y timestamps locales artificiales (`T12:00:00`) sin servicio de timezone de organización/sede. M1 exige Time como shared service. |
| M12-F006 | P1 | Open | Rules / Workflow | Reglas temporales de negocio (`LOT_PHASES`, `DEFAULT_PHASE_DAYS`) viven hardcodeadas dentro del dominio productivo. No existe aún una autoridad transversal de Rules/Workflow demostrable para el contrato M1. |
| M12-F007 | P1 | Open | Entitlements / authorization | El baseline M1 exige Entitlements, pero la autorización observable está basada en permissions/roles y no demuestra entitlement/capability de producto separado de IAM. Debe verificarse si existe autoridad equivalente antes de implementar nada nuevo. |

## Evidencia inicial

### M12-F001

`src/domain/accessControl.js`:
- membership con `companyId`, `siteIds`, roleId, overrides, denied permissions;
- `hasPermission({state,userId,companyId,siteId,permission})` valida tenant y sede.

`src/services/permissions.js`:
- `ROLE_PERMISSIONS` por etiqueta de rol local;
- `activeUser()` se basa en `state.users[].activeSession`;
- `hasPermission(state, permission)` no recibe organization/site ni membership.

### M12-F002

`src/pages/UsersPage.jsx`:
- crea perfiles locales en `state.users`;
- el primer perfil recibe `activeSession:true`;
- `session(id)` cambia manualmente la sesión local;
- `organizationForSite()` cae hasta `local-installation`;
- `remove(id)` elimina físicamente el usuario del array;
- mutaciones ocurren antes de la publicación de eventos.

### M12-F003 / F004

`src/components/AttachmentUploader.jsx`:
- usa `FileReader.readAsDataURL()`;
- guarda `{entityType, entityId, name, type, size, dataUrl}` en `state.attachments`;
- no guarda tenant/site;
- consulta por `entityType/entityId` solamente;
- no existe command boundary ni domain event documental visible en el componente.

### M12-F005 / F006

`src/domain/lifecycle.js`:
- `dateOnly(v=new Date()) => new Date(v).toISOString().slice(0,10)`;
- cálculos usan `T12:00:00` y una constante fija de 86,400,000 ms;
- fases y días default están hardcodeados en el módulo.

## Reglas de cierre

1. Una única autoridad productiva de authorization debe resolver user/membership/organization/site/capability.
2. Ninguna identidad local puede suplantar o divergir silenciosamente de la identidad empresarial autenticada.
3. Documents debe ser tenant-owned, auditable, persistible de forma adecuada y no depender de DataURL en el Store como System of Record.
4. Time debe tener semántica explícita de timezone/business date; sin conversiones implícitas que cambien fecha por UTC.
5. Rules/Workflow debe tener ownership y contrato compartido o documentarse explícitamente como capability faltante antes de M2.
6. Entitlements debe verificarse/implementarse como frontera distinta de roles si AH-001 así lo exige.
7. Pruebas adversariales cross-tenant, permission bypass, document collision, time boundary y retry/idempotency.
8. Quality completo verde.
9. Reauditoría independiente sin P0/P1 abiertos.

## Conteo inicial

- Open: 7
- Fixing: 0
- Fixed: 0
- Verified: 0
- Closed: 0
