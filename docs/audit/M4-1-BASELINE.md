# M4.1 — Inventory · Baseline forense

## Alcance

- Rama: `audit/v3-m4-1-inventory`
- Base apilada: `audit/v3-m3-2-mipe`
- Base SHA: `7ffbdb6123d1736d1269e159ff14c6eaef7097ff`
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Regla de certificación: ningún hallazgo se marca `Verified` sin una ejecución funcional de Quality.

## Estado

### F001 — Critical — Ready for Quality

**Manual inventory transaction was not tenant-aware and duplicate lot IDs could cause cross-tenant corruption.**

Evidencia en `src/domain/inventory.js` del SHA base:

1. `transactInventory()` resolvía el lote mediante un `find()` global por `lotId`.
2. No existía validación autoritativa de organización/empresa ni sede antes de operar.
3. El movimiento creado no persistía `organizationId` como propiedad de dominio de primera clase.
4. La actualización de `inventoryLots` usaba un `map()` global por el mismo ID crudo. Con IDs homónimos entre tenants, todos los registros con ese ID podían recibir un balance calculado sobre un solo candidato.

Impacto: una transacción manual podía cruzar el límite de tenancy y corromper existencias de otra organización cuando existían identidades homónimas.

#### Evidencia adversarial

- `tests/inventory-tenancy.test.js`
- Commit RED/evidence: `eef8e7478ccfb660852fcdb283e97c613af3c051`
- Ajuste de la prueba para derivar autoridad desde la empresa activa: `d7eabc42ec7144fdc5cd5be7824172de8bc8027e`

La prueba cubre:

- colisión del mismo `lotId` entre dos organizaciones con el lote extranjero primero en el array;
- rechazo de un lote que solo existe en otra organización;
- rechazo fail-closed de identidad duplicada dentro de la organización activa;
- persistencia de `organizationId`, `siteId`, `productId` y `lotId` en el movimiento.

#### Remediation

Commit: `40c446815d56458c3d1923a47119f95d053f50e1`

- la organización autoritativa se deriva de `activeOrganizationId(state)`;
- un `organizationId` suministrado por el caller no puede contradecir la organización activa;
- el lote se resuelve entre homónimos únicamente dentro de la organización activa;
- owner legacy solo se deriva desde una sede con ownership único o desde un estado inequívocamente monoempresa/local;
- ownership contradictorio o ambiguo falla cerrado;
- una sede declarada por el caller no puede contradecir la sede del lote;
- cada movimiento persiste `organizationId` y `siteId` explícitamente;
- la actualización muta exactamente el índice del candidato autorizado, eliminando el `map()` por ID global;
- los lotes nuevos reciben `organizationId` de primera clase.

#### Verificación focal previa a Quality

Se ejecutó un harness local con las tres pruebas adversariales de F001 sobre el código del remediation: **3/3 pass**.

Esta verificación focal no sustituye el Quality Gate completo.

**Estado:** Ready for Quality. No Verified.

### F002 — High — Ready for Quality

**El boundary genérico de sincronización permitía que `_organizationId` del envelope actuara como sustituto del ownership de dominio de Inventory.**

Evidencia en `src/services/syncEngine.js`:

1. `collectionChanges()` podía emitir cambios de `inventoryLots` e `inventoryMovements` cuyo `organizationId` de dominio estaba ausente.
2. `enqueueChanges()` aceptaba esos upserts ownerless y estampaba `_organizationId` con el tenant activo únicamente en el payload de sync.
3. `applyRemoteRecords()` rehidrataba registros de Inventory con `_organizationId` del transporte, sin materializar necesariamente `organizationId` de primera clase.

Impacto: el aislamiento de tenancy de Inventory podía depender del envelope de sincronización en lugar de una propiedad autoritativa del registro de dominio.

#### Evidencia adversarial

- `tests/inventory-sync-ownership.test.js`
- Commit RED/evidence: `5d67ac01c521b4013684cffd717ff8078305e18f`

La prueba cubre:

- rechazo de `inventoryLots` ownerless antes de encolarlos para sync;
- rechazo de `inventoryMovements` ownerless antes de encolarlos para sync;
- materialización de `organizationId` de primera clase al hidratar Inventory desde un company scope autenticado, conservando `_organizationId` únicamente como metadata de sincronización.

#### Remediation

Commit: `1c2b072f552c96ea88976416cfb26b34639ad840`

- `inventoryLots` e `inventoryMovements` exigen `organizationId` explícito antes de salir por el boundary de sync;
- el owner declarado debe coincidir con la empresa activa;
- `_organizationId` permanece como metadata del transporte y deja de ser sustituto del ownership de dominio;
- la hidratación remota de Inventory materializa `organizationId` desde el company scope ya validado;
- la lógica append-only de receipts MIPE permanece intacta;
- la resolución de registros legacy ownerless durante merge/hydration queda separada para F003.

#### Verificación focal previa a Quality

Se ejecutó `node --test tests/inventory-sync-ownership.test.js` sobre el código del remediation: **3/3 pass**, **0 fail**.

Esta verificación focal no sustituye el Quality Gate completo.

**Estado:** Ready for Quality. No Verified.

### F003 — Under investigation

Registros legacy de inventario sin owner explícito pueden producir resolución ambigua durante migración/sincronización. Este hallazgo permanece independiente de F002: el remediation de F002 evita crear/transportar nuevos registros ownerless, pero no certifica todavía la adopción o sustitución segura de registros legacy ya existentes.

### F004 — Under investigation

La creación de lotes requiere comprobar autoridad tenant-aware para producto, sede y unicidad del número de lote.

## Quality

GitHub Actions permanece bloqueado externamente antes del inicio del runner. Hasta disponer de una ejecución funcional de Quality, F001 y F002 permanecen `Ready for Quality` y no pueden marcarse `Verified`.
