# M3.3 F011 — UI / context

Estado: **Ready for Quality — no Verified**.

## Audit
La ruta de Inventory ya usaba `ProtectedRoute permission="view_inventory"`, pero la reauditoría encontró desalineaciones entre autorización, contexto y superficie UI:

1. `PERMISSIONS` no registraba `view_inventory`, aunque las rutas y roles legacy lo usaban.
2. El rol legacy `Inventario` tenía `manage_inventory` pero no `view_inventory`, de modo que podía satisfacer el command boundary pero no entrar al módulo.
3. `useInventoryCommandStore()` aplicaba scope solo por empresa. Un membership limitado a una sede podía entrar con esa sede activa y después recibir Lots/Movements de todas las sedes de la empresa.
4. Los formularios de Product/Lot/Movement se mostraban aunque el usuario tuviera únicamente lectura.
5. Product es autoridad organizacional (`CREATE_PRODUCT` exige `manage_inventory` sin `siteId`), mientras Lot/Movement son site-aware; la UI no distinguía ambos alcances.
6. `AppShell` filtraba navegación por entitlement, no por `view_inventory`, por lo que usuarios sin permiso veían enlaces de Inventory aunque la ruta después los rechazara.
7. Una sesión activa ambigua no debe escoger implícitamente un usuario para exponer Inventory.

## Fix
- `view_inventory` forma parte del catálogo canónico `PERMISSIONS`.
- El rol legacy `Inventario` declara `view_inventory + manage_inventory`.
- `inventoryUiAccess.js` deriva `canView`, `canManage` y `canManageProduct` desde sesión activa, empresa/sede activa y memberships.
- Más de un `activeSession` falla cerrado para Inventory UI.
- Sin `view_inventory`, `scopeInventoryUiState()` devuelve Product/Lot/Movement/Site vacíos.
- Con `siteId` activo y autorizado, Product permanece organizacional, mientras Lot/Movement/Site quedan limitados estrictamente a esa sede.
- Un membership site-scoped puede operar Lot/Movement si posee `manage_inventory`, pero no crear Product organizacional; un membership organizacional sí puede hacerlo.
- `useInventoryCommandStore()` usa ese scope para lectura y repite un preflight UI coherente con el alcance del command; el command boundary F003/F005 continúa siendo la autoridad final.
- `InventoryPage` y `InventoryMovementsPage` ocultan controles de escritura no autorizados y mantienen lectura para `view_inventory`.
- `AppShell` elimina `/inventory` y `/inventory/movements` tanto del menú como de la búsqueda global si falta `view_inventory`.

## Re-Audit
`ContextBar`/`operationalContextOptions()` ya eran membership-aware: compañías y sedes disponibles se derivan de memberships activos y una sede fuera del alcance no puede convertirse en contexto operativo válido. Esa autoridad se conservó sin modificaciones.

La reauditoría también confirmó que las rutas `/inventory` y `/inventory/movements` siguen envueltas en `Guard permission="view_inventory"`; el nuevo scope UI es defensa adicional y evita exposición si la superficie se reutiliza fuera de esas rutas.

## Test
Evidencia: `tests/m3-3-inventory-ui-context.test.mjs`.

Cubre:
- permiso canónico y rol Inventory;
- membership site-scoped sin fuga de Lots/Movements;
- sede activa no autorizada → cero datos;
- sesión ambigua → fail-closed;
- separación `canManageProduct` organizacional vs `canManage` site-aware;
- guard de rutas, ocultación de navegación y controles de escritura;
- preservación de la ruta `/irrigation/orders` durante la edición del AppShell.

## Quality
Pendiente. **No marcar F011 Verified** sin GitHub Actions Quality con runner real y steps ejecutados.
