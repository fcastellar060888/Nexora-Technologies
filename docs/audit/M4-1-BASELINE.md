# M4.1 — Inventory · Baseline forense

## Alcance

- Rama: `audit/v3-m4-1-inventory`
- Base apilada: `audit/v3-m3-2-mipe`
- Base SHA: `7ffbdb6123d1736d1269e159ff14c6eaef7097ff`
- Método: Audit → Evidence/Test → Fix → Quality Gate → Re-Audit → Close.
- Regla de certificación: ningún hallazgo se marca `Verified` sin una ejecución funcional de Quality.

## Estado inicial

### F001 — Critical — Confirmed

**Manual inventory transaction is not tenant-aware and duplicate lot IDs can cause cross-tenant corruption.**

Evidencia en `src/domain/inventory.js` del SHA base:

1. `transactInventory()` resuelve el lote mediante un `find()` global por `lotId`.
2. No existe una validación autoritativa de `organizationId`/empresa ni de la sede antes de operar.
3. El movimiento creado no persiste `organizationId` como propiedad de dominio de primera clase.
4. La actualización de `inventoryLots` usa un `map()` global por el mismo ID crudo. Si existen IDs homónimos entre tenants, todos los registros con ese ID reciben el nuevo balance calculado sobre un único candidato.

Impacto: una transacción manual puede cruzar el límite de tenancy y corromper existencias de otra organización cuando existen identidades homónimas.

**Estado:** Confirmed / remediation in progress.

### F002 — Under investigation

Ownership de lotes y movimientos no es explícito en todos los límites de dominio y parte del flujo depende del envelope de sincronización.

### F003 — Under investigation

Registros legacy de inventario sin owner explícito pueden producir resolución ambigua durante migración/sincronización.

### F004 — Under investigation

La creación de lotes requiere comprobar autoridad tenant-aware para producto, sede y unicidad del número de lote.

## Criterios adversariales mínimos de F001

- Dos organizaciones pueden contener el mismo `lotId` sin que una transacción de una organización modifique el lote de la otra.
- Un `lotId` perteneciente solo a otra organización debe rechazarse.
- Más de un candidato válido dentro del mismo scope debe fallar cerrado por ambigüedad.
- El movimiento debe persistir `organizationId` y `siteId`.
- La mutación debe afectar exactamente a un lote autorizado.

## Quality

GitHub Actions permanece bloqueado externamente antes del inicio del runner en el bloque M3.2. Hasta disponer de una ejecución funcional de Quality, cualquier remediation de M4.1 podrá alcanzar como máximo `Ready for Quality`, nunca `Verified`.
