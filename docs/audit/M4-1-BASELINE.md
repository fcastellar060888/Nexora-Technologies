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

### F003 — High — Ready for Quality

**Registros legacy de Inventory sin owner explícito podían ser adoptados ambiguamente por el tenant activo durante migración/hidratación.**

Evidencia en el HEAD previo al remediation:

1. `stateMigration.js` normalizaba `inventoryLots.quantity` pero no materializaba `organizationId` para lotes o movimientos legacy.
2. `applyRemoteRecords()` consideraba un registro local sin owner como candidato válido del tenant activo cuando coincidía el `recordId`.
3. Con un ID homónimo y ownership local ausente, una respuesta remota autenticada para una empresa podía reemplazar ese registro legacy y asignarle el tenant del envelope sin prueba suficiente de ownership histórico.

Impacto: adopción/reemplazo ambiguo de inventario legacy, con pérdida de integridad tenant-aware y riesgo de reatribución cross-company.

#### Evidencia adversarial

- `tests/inventory-legacy-ownership.test.js`
- Commit RED/evidence: `4d9dc0449799babed2f3440d54c8be46ef57552c`

La prueba cubre:

- derivación de owner para lotes y movimientos legacy únicamente desde una sede con ownership explícito;
- no adopción por la empresa activa cuando el ownership de la sede no puede probarse en un estado multiempresa;
- rechazo fail-closed de un homónimo local ownerless durante hidratación remota;
- preservación de un homónimo extranjero y actualización exclusiva del registro explícitamente perteneciente al tenant activo.

#### Remediation

Commits:

- migración determinística: `848ab3d33d0e83a2ce6d544d0c8a80942c717faf`
- fail-closed en sync: `4f912669f260bb2fe497063c4f4faad02d92ae23`

Cambios:

- `CURRENT_SCHEMA_VERSION` sube a `15`;
- `inventoryLots` e `inventoryMovements` legacy reciben `organizationId` sólo cuando puede derivarse desde una sede explícitamente poseída o desde un estado inequívocamente monoempresa;
- la empresa activa deja de ser una suposición suficiente para atribuir ownership de Inventory legacy en estados multiempresa;
- un homónimo ownerless pendiente de migración bloquea la hidratación de Inventory en vez de ser adoptado;
- duplicados homónimos dentro del tenant activo bloquean la hidratación por ambigüedad;
- homónimos explícitamente pertenecientes a otras organizaciones se preservan y no participan en el match del tenant activo.

#### Verificación focal previa a Quality

Se ejecutó un harness focal de las cuatro garantías adversariales de F003 sobre la lógica publicada: **4/4 pass**, **0 fail**.

Esta verificación focal no sustituye el Quality Gate completo.

**Estado:** Ready for Quality. No Verified.

### F004 — High — Ready for Quality

**La creación de lotes confiaba en IDs crudos de producto/sede y aplicaba unicidad de número de lote sin scope de organización.**

Evidencia en `createInventoryLot()` antes del remediation:

1. `productId` y `siteId` sólo se comprobaban como strings presentes; no se resolvía que el producto y la sede pertenecieran a la empresa activa.
2. Un caller podía suministrar un `organizationId` contradictorio sin que la creación lo rechazara explícitamente.
3. La unicidad se calculaba con `productId + siteId + lotNumber` sobre todo `inventoryLots`, por lo que IDs homónimos cross-tenant producían falsos duplicados.
4. Una identidad de producto duplicada dentro del mismo tenant no fallaba cerrada.

Impacto: creación de lotes relacionados con objetos de otra empresa, falsos conflictos entre tenants y persistencia de relaciones ambiguas.

#### Evidencia adversarial

- `tests/inventory-lot-creation-tenancy.test.js`
- Commit RED/evidence: `03e53651382f3e90ed3ecc0180869ec8f3862f80`

La prueba cubre:

- rechazo de producto perteneciente sólo a otra organización;
- rechazo de sede perteneciente sólo a otra organización;
- rechazo de spoof de `organizationId` por el caller;
- mismo `productId`, `siteId` y `lotNumber` permitido entre organizaciones distintas cuando los registros homónimos están explícitamente poseídos;
- mismo número de lote prohibido dentro del tenant para el mismo producto+sede;
- identidad duplicada de producto dentro del tenant rechazada por ambigüedad.

#### Remediation

Commit: `8327a3f9c6e1f8b788f2e3c54a8d0feeb8c1fa90`

- autoridad derivada de `activeOrganizationId(state)` antes de crear;
- `organizationId` suministrado por el caller no puede contradecir la empresa activa;
- producto y sede se resuelven por ID + ownership dentro del tenant activo;
- referencias ownerless en estado multiempresa fallan cerradas;
- duplicados de referencia dentro del tenant fallan por ambigüedad;
- la unicidad de `lotNumber` se evalúa sólo dentro del tenant activo para el mismo producto+sede;
- homónimos explícitamente extranjeros no bloquean la creación legítima del tenant activo;
- lotes legacy con ownership ambiguo bloquean la creación hasta migración;
- una identidad de lote suministrada por caller no puede duplicarse dentro del tenant activo.

#### Verificación focal previa a Quality

Se ejecutó la suite exacta de F004 contra la lógica publicada: **6/6 pass**. También se ejecutó conjuntamente con `tests/inventory-tenancy.test.js` de F001: **9/9 pass, 0 fail**.

Esta verificación focal no sustituye el Quality Gate completo.

**Estado:** Ready for Quality. No Verified.

## Resultado del bloque

M4.1 Inventory tiene **4/4 hallazgos técnicamente corregidos y Ready for Quality**. Ninguno se marca `Verified` mientras GitHub Actions no ejecute un runner funcional.

## Quality

GitHub Actions continúa presentando el bloqueo externo previo al runner observado en este bloque y en M3.2. Los runs anteriores concluyeron `failure` con `steps: null` y `logs_url: null`, es decir, sin ejecución del código. El run asociado al HEAD final de M4.1 debe evaluarse con el mismo criterio: sólo una ejecución funcional y verde permite promover F001–F004 a `Verified`.
