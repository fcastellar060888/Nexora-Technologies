# M4.7 — Identidad / Usuarios / Control de acceso · Baseline forense

## Alcance

- Rama: `audit/v3-m4-7-identity-access`
- Base apilada: `audit/v3-m4-6-observability`
- Base SHA: `4f51cf2aac902bf95a5fc2865106c107d8b1c148`
- Superficie inicial: usuarios, membresías, roles, sedes autorizadas, administración remota y guards de acceso.
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Actions sin cuota: máximo estado antes de CI real = `Ready for Quality`.

## F001 — Critical — Confirmed

`UsersPage.jsx` importa estáticamente `../services/authAdminService.js`, pero el módulo no existe. La página está importada desde `App.jsx`, por lo que el import irresoluble compromete la integridad del build. Tampoco existe en `supabase/` un RPC/Edge Function administrativo que permita crear identidades de Auth de forma segura.

La remediación no puede introducir `service_role` en el navegador: la autoridad administrativa debe vivir server-side y verificar la membresía/permisos del caller.

Evidence/RED: `tests/identity-admin-boundary.test.js` @ `4fb76538e8d279432016869af5d20ea225c2a9e5`.

## F002 — Critical — Confirmed

`UsersPage` mezcla identidad global con acceso organizacional: lista `state.users` globalmente y las acciones de desactivar/eliminar mutan `user.active` o eliminan el usuario y todas sus membresías. Un administrador de empresa A puede afectar el acceso del mismo usuario en empresa B.

El boundary correcto para `manage_users` de tenant es la membresía de la empresa activa, no la identidad global.

Evidence/RED: `tests/identity-admin-boundary.test.js` @ `4fb76538e8d279432016869af5d20ea225c2a9e5`.

## F003 — Critical — Confirmed

`UsersPage` ofrece `state.sites` globalmente y `canAccessSite()` confía en que `membership.siteIds.includes(siteId)` implica ownership. Una membresía de empresa A puede incluir el ID de una sede de B y obtener acceso; con IDs homónimos la resolución por raw ID tampoco es inequívoca.

Evidence/RED: `tests/access-site-tenancy.test.js` @ `5bb8d98a3bd5837f99f743bfa568732babce6446`.

## Nota de reauditoría

La hipótesis de bypass por URL directa fue descartada: `App.jsx` sí envuelve las rutas sensibles con `ProtectedRoute` y permisos explícitos. No se registra como hallazgo.

## Quality

El futuro PR permanecerá draft para que Quality quede `skipped` sin runner. Ningún hallazgo será `Verified` sin ejecución real y verde.
