# Nexora One — Auditoría Forense v3 · M1.2 Core Shared Services & Governance

Estado: **CLOSED — reauditoría completa**
Base certificada: M1.1 Core Operations, head `9b3964313fb2f2b24bc0b4489b6e1e16342986cb`, Quality #1592 verde.
Head M1.2 reauditorado: `2e4b890dbd65e4c5fa839bc776b04022fe5f510e`.
Arquitectura: AH-001 — M1 Core Platform Ready exige Tenant, Organization/Sites, IAM, Audit, Workflow, Documents, Units, Time, Rules y Entitlements.
Método aplicado: Audit → Fix → Test → Quality Gate → Re-Audit → Close.

## Resultado final

| ID | Sev. | Estado | Área | Evidencia de cierre |
|---|---:|---|---|---|
| M12-F001 | P0 | **Closed** | IAM / authorization | `services/permissions.js` delega a la autoridad scoped de `domain/accessControl.js`; remote user sin membership, tenant ajeno y sede ajena quedan deny. Quality #1605 verde. |
| M12-F002 | P0 | **Closed** | Identity / tenancy | En enterprise la identidad autenticada es única; `UsersPage` no puede seleccionar/borrar físicamente identidades locales. Standalone queda limitado a instalación y mutaciones auditadas. Quality #1611 verde. |
| M12-F003 | P0 | **Closed** | Documents / tenancy | Documents tiene ownership por organización/sede, filtro defensivo y RLS; se corrigió además un bypass real donde una sede extranjera podía desplazar el tenant activo. Quality #1639 verde. |
| M12-F004 | P1 | **Closed** | Documents / persistence/security | Bytes fuera del Store, Storage privado, SHA-256, MIME/tamaño, lifecycle `pending → active → archived`, eventos canónicos y cuarentena de DataURL históricos sin reinyectarlos al sync. Quality #1639 verde. |
| M12-F005 | P1 | **Closed** | Time | `timeAuthority.js` separa fecha civil de timestamp y resuelve business date por timezone de sede/empresa; lifecycle dejó de usar `T12:00:00`. Quality #1645 verde. |
| M12-F006 | P1 | **Closed** | Rules / Workflow | `ruleEngine.js` provee autoridad transversal determinista y explicable; lifecycle resuelve override de lote → genética → general → default mediante RuleSet, no `find()` ad hoc. Quality #1651 verde. |
| M12-F007 | P1 | **Closed** | Entitlements / authorization | Entitlements de producto están separados de IAM: capability por organización, RLS, carga con identidad remota, enforcement en `ProtectedRoute` y misma autoridad para navegación. Contrato explícito falla cerrado; organizaciones legacy sin contrato quedan grandfathered hasta provisioning. Quality #1667 verde. |

## Reauditoría por frontera

### IAM e identidad

- Una sola semántica productiva de autorización: usuario autenticado + membership activa + organization/site + role permissions + overrides/denials.
- Un rol local no concede permisos a una identidad remota sin membership.
- Una membership de otra organización o restringida a otra sede no autoriza el contexto activo.
- `activeSession` local dejó de ser autoridad empresarial.
- El modo `local-installation` existe únicamente cuando no hay identidad/memberships/organizaciones empresariales configuradas.

### Documents

- Metadata canónica separada de bytes.
- Bucket privado `documents` y tabla `public.documents` con RLS por organización.
- Storage path tenant-prefixed y checksum SHA-256.
- Validación de imagen/video/PDF, archivo no vacío y límite contractual de 25 MB.
- Lifecycle no destructivo; no existe policy DELETE normal para cliente autenticado.
- Adjuntos inline históricos quedan preservados en recovery quarantine y salen del Store/sync operativo.
- `attachments` dejó de formar parte del sync genérico.

### Time

- Aritmética por fecha civil, no por milisegundos de días artificiales.
- Business date derivada de timezone de sede/empresa.
- Pruebas cubren medianoche UTC/Bogotá, DST, años bisiestos y fechas inválidas.

### Rules / Workflow

- `workflowCore.js` conserva la autoridad compartida de state transitions.
- `ruleEngine.js` añade rule sets con prioridad, especificidad, tie-break estable y explicación de decisión.
- Lifecycle conserva el contrato de negocio existente pero la regla ganadora queda identificable mediante `ruleId`.
- Reglas inválidas/inactivas no pueden desplazar una regla válida.

### Entitlements

- IAM responde **quién puede ejecutar una acción**; Entitlements responde **qué capability de producto tiene habilitada la organización**.
- `organization_entitlements` tiene RLS de lectura para miembros de la organización.
- No existen policies INSERT/UPDATE/DELETE para clientes autenticados: un usuario de la app no puede autoaprovisionar capabilities.
- `ProtectedRoute` aplica entitlement por path antes de entregar el módulo.
- `AppShell` usa la misma autoridad para navegación y búsqueda, evitando divergencia visual.
- Entitlements son governance state y no son reemplazados por el bootstrap operacional.

## Quality gates certificados

- #1605 — M12-F001 — verde.
- #1611 — M12-F002 — verde.
- #1639 — M12-F003/F004 + migración legacy — verde.
- #1645 — M12-F005 — verde.
- #1651 — M12-F006 — verde.
- #1667 — M12-F007 — verde.

Todos los runs de cierre completaron: Static Audit, Dependency Audit, Environment Contract Audit, Authentication/Session Audit, Functional Tests, Coverage Gate, Production Build y Production Artifact Audit.

## Reglas de cierre verificadas

1. **Cumplida:** una única autoridad productiva de authorization resuelve user/membership/organization/site/capability IAM.
2. **Cumplida:** ninguna identidad local puede suplantar silenciosamente la identidad empresarial autenticada.
3. **Cumplida:** Documents es tenant-owned, auditable y usa storage apropiado; DataURL dejó de ser System of Record.
4. **Cumplida:** Time tiene semántica explícita de timezone/business date.
5. **Cumplida:** Rules/Workflow tiene ownership y contrato compartido demostrable.
6. **Cumplida:** Entitlements existe como frontera distinta de roles/permisos.
7. **Cumplida:** pruebas adversariales cubren cross-tenant, permission bypass, document collision, time boundary, rules y entitlement separation.
8. **Cumplida:** Quality completo verde.
9. **Cumplida:** reauditoría independiente sin P0/P1 abiertos.

## Conteo final

- Open: **0**
- Fixing: **0**
- Fixed sin verificar: **0**
- Verified sin cerrar: **0**
- Closed: **7**

## Estado de integración

PR #42 permanece **draft**, abierto y no fusionado. M1.2 queda técnicamente cerrado; el siguiente paso de integración debe mantener la política del proyecto: revisar el diff final del PR y solo entonces decidir promoción/merge sobre la base M1.1.
