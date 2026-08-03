# AUD-F045 — Bootstrap multiempresa no destructivo

## Hallazgo

La hidratación autoritativa reemplazaba colecciones operativas completas con el snapshot remoto de la empresa activa. Esto podía eliminar del estado global en memoria registros explícitamente pertenecientes a otras empresas y consolidar esa pérdida durante la persistencia posterior.

## Causa raíz

- `hydrateAuthoritativeState()` sustituía cada colección por `grouped[collection] || []`.
- La identidad de registros se comparaba únicamente por `id`, sin incorporar tenant.
- Las filas remotas no conservaban una marca organizacional canónica dentro del payload hidratado.
- `compactCompanyState()` filtraba solamente `record.companyId`, ignorando `_organizationId` y `organizationId`.

## Corrección

- Cada registro remoto queda marcado con `_organizationId`.
- Bootstrap reemplaza únicamente la partición correspondiente a la empresa solicitada.
- Registros de otras empresas permanecen intactos.
- Identidades y reconciliación usan `organizationId + recordId`.
- Mutaciones pendientes se aplican únicamente sobre la partición activa y no colisionan con IDs iguales de otros tenants.
- La caché segmentada reconoce `_organizationId`, `companyId` y `organizationId` al filtrar colecciones.

## Pruebas adversariales

- Preservación de otra empresa durante bootstrap.
- IDs iguales en empresas distintas.
- Snapshot remoto vacío que elimina solo la partición activa.
- Mutación pendiente con el mismo ID que un registro extranjero.
- Persistencia segmentada que no copia registros extranjeros al archivo de la empresa activa.
- Compatibilidad con aliases de propiedad organizacional.

## Certificación

- Quality #758 detectó dos expectativas históricas incompatibles con el nuevo metadata y la migración normalizada.
- Quality #762: success.
- Reauditoría independiente detectó la ruta residual de `compactCompanyState()`.
- Quality #766: success sobre la corrección completa.

## Dictamen

AUD-F045 queda cerrado. Bootstrap, reconciliación concurrente, mutaciones pendientes y persistencia local conservan aislamiento por tenant sin destruir ni mezclar las particiones de otras empresas.
