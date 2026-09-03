# Nexora One — Auditoría Forense v3 · M3.2 MIPE

Estado: **CERTIFIED CLOSURE CANDIDATE — 12/12 Verified**  
Condición final: el commit que contiene este cierre documental debe obtener un **Quality real completamente verde**.  
Candidato funcional certificado: `be85c67798738fcd535a470ab6145818e74ef921`.  
Base certificada de entrada: M3.1 Irrigation & MIRFE, `6943ad022ba7c88fc7eb1b5111552f4b06b22992`, Quality #1919 verde.  
Método: Audit → Fix → Test → Quality → Re-Audit → Close.

> El expediente detallado acumulado de F001–F009 permanece íntegro en el historial Git del archivo, inmediatamente antes de este cierre, en `be85c67798738fcd535a470ab6145818e74ef921`. Este baseline final compacta el estado certificado sin borrar esa evidencia histórica.

## Alcance certificado

M3.2 queda auditado como autoridad MIPE operativa end-to-end: Incident, Finding, workflow, Intervention, Treatment, Product, Lot, costo, restricciones de reentrada/carencia/propagación, tenancy, command boundaries, idempotencia, persistencia/sync, contexto jerárquico, Dashboard/croquis, Passport/Knowledge Graph y adversariales requested→commit.

## Estado de hallazgos

| ID | Sev. | Estado | Área | Evidencia de cierre |
|---|---:|---|---|---|
| M32-F001 | P0 | **Verified** | Domain authority | Quality #1926. |
| M32-F002 | P0 | **Verified** | Tenancy | Quality #1945; reauditoría final de backfill incluida en #2975. |
| M32-F003 | P0 | **Verified** | Commands / permissions / events | Quality #1983; documental #1986. |
| M32-F004 | P0 | **Verified** | Treatment / inventory transaction | Quality #2000; documental #2002; exactamente cinco consecuencias preservadas. |
| M32-F005 | P1 | **Verified** | Workflow / audit history | Quality #2034. |
| M32-F006 | P1 | **Verified** | Follow-up / interventions | Quality #2076; documental #2078. |
| M32-F007 | P1 | **Verified** | Incident / Product authority | Quality #2118; documental #2120. |
| M32-F008 | P1 | **Verified** | Persistence / sync | Quality #2135. |
| M32-F009 | P1 | **Verified** | Operational restrictions | Quality #2176. |
| M32-F010 | P1 | **Verified** | Dashboard / croquis / context | Quality #2975, reauditoría funcional integral 1236/1236. |
| M32-F011 | P1 | **Verified** | Passport / Knowledge Graph | Quality #2975 después de reparación causal fail-closed y reauditoría histórica. |
| M32-F012 | P1 | **Verified** | Adversarial verification | Quality #2975, cero fallos/cancelados/skipped. |

## M32-F001–F009 — continuidad de certificación

Los nueve cierres previos conservan sus autoridades y evidencia original. La reanudación de runners no reabrió esos hallazgos, pero sí ejecutó de nuevo toda la suite acumulada sobre el candidato final. Quality #2975 volvió a validar sus contratos junto con F010–F012.

Invariantes transversales preservadas:

- ownership e identidad tenant-aware; ningún lookup operativo depende de ID global;
- command boundaries permission-aware, receipts e idempotencia effect-once;
- workflow de Finding e historias/correcciones append-only;
- Treatment congela evidencia Product/Lot y F004 mantiene exactamente `inventoryLots`, `inventoryMovements`, `treatments`, `findings`, `costEntries`;
- persistencia, bootstrap, sync y tombstones preservan identidad por tenant y fallan cerrado;
- reentrada, carencia y propagación se derivan de evidencia causal y no pueden saltarse desde UI.

## M32-F010 — Dashboard / croquis / contexto — Verified

### Cierre

- `src/domain/operationalContext.js` resuelve el contexto operativo autorizado y mantiene la jerarquía Empresa → Sede → Nave → Cama → Planta; la rama material mantiene Empresa → Sede → Genética sin mezclar jerarquías Position.
- `ContextBar`, perfiles de planta/material, Dashboard MIPE, House Map y mapa unificado consumen estado scoped al contexto activo en vez de filtrar entidades por IDs globales.
- El acceso directo a un perfil de planta resuelve su contexto autorizado antes de construir el Passport y sincroniza únicamente `currentContext`; la escritura de eventos sigue pasando por `executePlantEventCommand()`.
- Un cambio de planta/sede invalida selección y drafts locales para impedir que una intención preparada en un contexto se ejecute en otro.
- El Dashboard usa la frontera MIPE y el scope operacional actual; las acciones de seguimiento/reasignación no reintroducen mutadores legacy.
- El croquis mantiene selección y acciones bulk site-scoped y enruta la escritura por el command canónico de eventos de planta.

### Evidencia

- `tests/m3-2-mipe-operational-context.test.mjs`
- `tests/m3-2-mipe-operational-context-persistence-ui.test.mjs`
- `tests/m3-2-mipe-context-membership.test.mjs`
- `tests/m3-2-mipe-context-plant-event.test.mjs`
- `tests/m3-2-mipe-house-map-context.test.mjs`
- `tests/m3-2-mipe-plant-profile-context.test.mjs`
- `tests/mipe-dashboard-actions-ui.test.mjs`
- `tests/unified-map-selection.test.mjs`

Quality #2975 ejecutó estas pruebas junto con la regresión completa y terminó verde.

## M32-F011 — Passport / Knowledge Graph — Verified

### Cierre

- `src/core/passport/mipePassportProjection.js` proyecta la cadena explicable `Finding → Incident → Intervention/Treatment → Product/Lot → Restriction → Resolution` y valida la historia antes de emitir evidencia.
- `cultivationPlantPassport.js` deriva la ubicación Position por la ascendencia canónica Bed → House → Site; redundancias contradictorias o referencias ambiguas fallan cerrado.
- `materialPlantPassport.js` resuelve Site, Genetic y parent plant dentro del tenant activo; homónimos extranjeros no contaminan el grafo y duplicados same-tenant fallan cerrado.
- Las correcciones históricas de Incident se reconstruyen as-of y sus relaciones sobreviven incluso si no existe Intervention contemporánea.
- Los estados terminales `Resuelto`, `Falso positivo` y `Planta eliminada` se conservan como Resolution; un historial adulterado no se proyecta silenciosamente.
- La reauditoría de certificación reprodujo un defecto real: evidencia same-tenant causalmente corrupta podía quedar filtrada antes del projector y desaparecer en vez de fallar cerrado. La reparación incorporada en la rama de certificación vuelve auditable esa evidencia y mantiene estricta la autoridad operativa normal.
- El enriquecimiento del Passport ya no elimina indiscriminadamente todos los eventos legacy `treatment:`: sólo reemplaza un Treatment legacy cuando el trace canónico contiene ese mismo `sourceId`. La evidencia histórica no reemplazable permanece visible.

### Evidencia

- `tests/m3-2-mipe-passport-knowledge-graph.test.mjs`
- `tests/m3-2-mipe-passport-knowledge-graph-integration.test.mjs`
- `tests/m3-2-mipe-passport-knowledge-graph-ui.test.mjs`
- `tests/m3-2-mipe-passport-causality.test.mjs`
- `tests/m3-2-mipe-passport-position-location-causality.test.mjs`
- `tests/m3-2-mipe-passport-material-reference-causality.test.mjs`

La reparación final también preserva evidencia histórica de Treatment sin relajar Product/Lot/tenant causality.

## M32-F012 — Adversarial verification — Verified

### Reauditoría transversal final

La suite adversarial final confirma, entre otros casos:

- homónimos cross-tenant y cross-site no alteran ownership ni causalidad;
- IDs duplicados same-tenant fallan cerrado aunque los registros parezcan equivalentes;
- receipts MIPE son tenant-explicit, durables e idempotentes; tombstones/sync no borran el homónimo extranjero;
- requested→commit vuelve a resolver identidad causal y rechaza cambios de Finding target, Treatment→Finding e Intervention→Finding ocurridos durante la ventana TOCTOU;
- `executeTreatment()` no puede ejecutar sobre Finding terminal, falso positivo o planta eliminada;
- F004 mantiene exactamente cinco consecuencias atómicas y no incorpora receipts como una sexta colección;
- la identidad de material vegetal queda ligada a Lot/Site canónicos; overrides contradictorios se ponen en cuarentena o fallan cerrado por tenant;
- correcciones de Finding deben mantener cadenas before/after íntegras;
- la ascendencia Position redundante/contradictoria falla cerrado;
- Passport/Knowledge Graph conserva Resolution y estados terminales en la proyección final.

### Evidencia

- `tests/m3-2-mipe-adversarial-final.test.mjs`
- `tests/m3-2-mipe-adversarial-command-commit-scope.test.mjs`
- `tests/m3-2-mipe-adversarial-causal-identity-toctou.test.mjs`
- `tests/m3-2-mipe-adversarial-material-terminal.test.mjs`
- `tests/m3-2-mipe-adversarial-operational-permissions.test.mjs`
- `tests/m3-2-mipe-material-plant-identity-causality.test.mjs`
- suites de persistencia, workflow, Passport y concurrencia F004 incluidas en la ejecución integral.

## Recuperación de runners y reauditoría de certificación

Tras recuperarse GitHub Actions, el candidato congelado dejó de estar bloqueado por infraestructura y pasó a una reauditoría real:

1. Runs reales rojos permitieron separar defects de producto de contratos de prueba obsoletos.
2. Se corrigió el backfill de Incidents legacy para que la migración no dependa circularmente del resolver runtime de Findings. La autoridad runtime normal permanece estricta.
3. Se corrigió la preservación selectiva de Treatment histórico en Passport.
4. Las expectativas históricas se alinearon con contratos ya endurecidos sin retirar las invariantes que auditaban.
5. Commit funcional final: `be85c67798738fcd535a470ab6145818e74ef921`.

## Quality #2975 — evidencia funcional de certificación

Quality #2975 se ejecutó con runner GitHub-hosted real sobre el SHA exacto `be85c67798738fcd535a470ab6145818e74ef921`.

- Static audit: **success**
- Dependency audit: **success**
- Environment contract audit: **success**
- Authentication/session audit: **success**
- Functional tests: **1236/1236 pass**
- Fail: **0**
- Cancelled: **0**
- Skipped: **0**
- Coverage gate: **success**
- Production build: **success**
- Production artifact audit: **success**
- `functional-test-evidence` artifact: `9827843605`
- digest: `sha256:7eaa30f6fe0610c904dfbd7f289c4ddc8871405f1fc062d928b2596332d0a6e6`

## Criterios de cierre M3.2

1. Entidades MIPE tenant-owned e identidad estable. **Cumplido.**
2. Ningún lookup operativo depende de ID global. **Cumplido.**
3. Ninguna UI MIPE significativa escribe dominio directamente en Store. **Cumplido.**
4. Mutaciones por command boundary permission-aware e idempotente. **Cumplido.**
5. Treatment atómico respecto de lote, movimiento, costo, Treatment, Finding y evidencia. **Cumplido.**
6. Workflow e historial append-only sin reescritura silenciosa. **Cumplido.**
7. Seguimientos/intervenciones persistentes, tenant-aware y causales. **Cumplido.**
8. Product/dosis/Lot/reentrada/carencia ligados a evidencia verificable. **Cumplido.**
9. Cache/bootstrap/sync/tombstones preservan identidad por tenant. **Cumplido.**
10. Dashboard/croquis respetan el contexto operativo jerárquico. **Cumplido.**
11. Passport/Knowledge Graph explican la cadena MIPE sin contaminación extranjera. **Cumplido.**
12. Quality funcional completo verde y reauditoría final sin P0/P1 abiertos. **Cumplido por #2975.**

## Orden de cierre ejecutado

1. F001–F009 — **Verified** por sus Quality históricos y regresión #2975.
2. F010 Dashboard/croquis/context — **Verified**.
3. F011 Passport/Knowledge Graph — **Verified**.
4. F012 Adversarial verification — **Verified**.

## Estado actual

- Verified: **12**
- Open: **0**
- P0 abiertos: **0**
- P1 abiertos: **0**

## Condición documental final

Este archivo constituye el único delta documental posterior al candidato funcional `be85c67798738fcd535a470ab6145818e74ef921`. M3.2 se declara definitivamente **12/12 Verified** únicamente cuando el workflow `Quality` de este commit documental se ejecute con runner real y concluya completamente verde. No se autoriza merge ni modificación de `main` como parte de esta certificación.
