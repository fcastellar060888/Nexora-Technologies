# ADR-M3-1-001 — Aislamiento tenant de Irrigation/MIRFE

- Estado: **Accepted**
- Fecha: 2026-08-16
- Bloque: M3.1 Irrigation & MIRFE
- Hallazgo: M31-F002

## Contexto

Las colecciones legacy `waterAnalyses`, `nutrientProducts`, `nutrientObjectives`, `irrigationPlans`, `formulations`, `tankPreparations` e `irrigationApplications` se leían y mutaban desde React sobre arreglos globales. Sus registros no exigían `organizationId` y varias operaciones resolvían referencias por `id` simple.

Como Nexora One admite IDs históricos repetidos entre empresas y sedes, filtrar únicamente por `siteId` o confiar en la ruta autorizada no constituye aislamiento de dominio. Una corrección UI-only tampoco protegería invocaciones directas de preparación, consumo o aplicación.

## Decisión

1. La identidad operativa de Irrigation/MIRFE es `(organizationId, id)`.
2. Cada superficie legacy opera sobre una vista del Store restringida a la empresa activa.
3. El merge conserva registros extranjeros y solo sustituye/elimina identidades del tenant activo.
4. Todo registro nuevo o derivado recibe `organizationId` explícito antes de persistencia y sync.
5. Preparación, ejecución y aplicación aplican la misma frontera dentro del dominio, independientemente del llamador.
6. La migración v11 atribuye ownership histórico únicamente cuando sede o referencias causales producen un solo propietario posible.
7. Un registro histórico ambiguo no se asigna silenciosamente a la empresa activa: permanece sin ownership y falla cerrado en modo multiempresa.
8. La compatibilidad local se conserva para instalaciones sin empresas o con una sola empresa inequívoca.

## Consecuencias

- IDs homónimos de `org-a` y `org-b` pueden coexistir sin fuga, overwrite ni delete cruzado.
- El consumo de inventario, costo y orden generados por MIRFE heredan la empresa de la preparación activa.
- El sync tenant-aware heredado de M2.2 recibe ownership explícito y conserva su identidad compuesta.
- Registros legacy ambiguos requieren una futura conciliación administrativa explícita; no se reescribe historia mediante una atribución especulativa.
- Esta decisión no sustituye el command/action boundary ni la idempotencia durable. M31-F003 y M31-F006 permanecen abiertos.
- Las nuevas entidades canónicas de M31-F001 todavía requieren persistencia/bootstrap/sync explícitos bajo M31-F011.

## Alternativas descartadas

- **Filtrar solo en componentes React:** no protege llamadas de dominio ni procesos futuros.
- **Asignar todos los legacy a `currentContext.companyId`:** puede secuestrar datos ambiguos de otra empresa.
- **Mantener `id` como identidad global:** contradice los contratos multiempresa ya certificados.
- **Modificar el inventario global dentro de F002:** ampliaría innecesariamente el alcance; la ejecución MIRFE usa una vista tenant antes de delegar el cálculo de stock.

## Evidencia

- Solución: `f441909aa8de8d10ae7656aeca45b2137853ddc1`.
- Corrección de contrato histórico de tests: `cf6f77bed89c94b85a0783ef3282da21c97cc34a`.
- Pruebas: `tests/m3-1-irrigation-mirfe-tenancy.test.mjs`, `tests/m3-1-irrigation-mirfe-tenant-ui-contract.test.mjs` y `tests/stateMigration.test.mjs`.
- Quality #1853: verde, 854/854 pruebas, cobertura/build/artifact audit aprobados.
