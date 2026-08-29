# M4.4 — Finanzas operativas · Reauditoría sobre baseline actual

- Rama: `audit/v3-m4-4-finance-current`
- Base: `audit/v3-m4-3-sales-current`
- Base SHA: `bb04cecf096446dc3d2197d70002fbc432deae6d`
- Regla: ningún hallazgo pasa a Verified sin Quality con runner real y steps ejecutados.

## F001 — Critical — Ready for Quality

Defecto confirmado: `CurrenciesPage` administraba `state.currencies` globalmente por `code`, de modo que monedas homónimas de empresas distintas podían interferir en existencia, actualización y renderizado. Los registros ownerless además podían ser adoptados silenciosamente en estados multiempresa.

Remediación: `src/domain/finance.js` introduce una frontera tenant-aware para monedas; resolución fail-closed de homónimos/ownership ambiguo, validación de organización solicitada, identidad determinística `currency:<organizationId>:<CODE>` y tasa estrictamente positiva. `CurrenciesPage` consume exclusivamente esa autoridad y conserva la organización esperada en el formulario.

Evidence: `tests/finance-tenancy.test.js` cubre mutación exacta de homónimos, spoofing/duplicados intra-tenant, legacy ownerless multiempresa y contrato estático de UI.

**Estado:** F001 Ready for Quality — no Verified. F002–F006 pendientes de reauditoría individual.
