# Auditoría forense de Nexora One

## Alcance

Esta auditoría revisa el estado real del producto en la rama `foundation/event-bus-core` antes de continuar la expansión del Core. Su objetivo es proteger datos, trazabilidad, aislamiento multiempresa y reproducibilidad; retirar duplicaciones; y certificar cada corrección mediante pruebas, build y reauditoría independiente.

## Cadena de custodia

- Repositorio: `fcastellar060888/Nexora-Technologies`
- Rama principal: `main`
- Rama auditada: `foundation/event-bus-core`
- Pull Request principal: `#26`
- Commit inicial histórico de auditoría: `a0dd26aded0e827fce732362ad7e300642be6ba4`
- PR verificado: abierto, mergeable y 308 commits adelantado respecto a `main`
- Entorno declarado: Node.js `>=20.19.0`
- Quality actual: auditoría estática propia, pruebas Node y build Vite
- Comando actual: `npm install --no-audit --no-fund && npm run check`
- Comando objetivo reproducible: `npm ci --no-fund && npm run check`

Cada corrección debe registrar el hallazgo mitigado, commit, prueba añadida o modificada, resultado de Quality y resultado de reauditoría.

## Estado de la primera pasada

La fase de descubrimiento quedó cerrada sobre Events, Ledger, Timeline, Passport, Knowledge Graph, Projection Engine, React/Store, rutas, consumidores, pruebas, dependencias y despliegue.

El conteo oficial de esta pasada es **66 hallazgos numerados `AUD-F001` a `AUD-F066`**. Durante la conversación se comunicó un total provisional de 67; se corrigió porque la secuencia real termina en 066. Los cuatro registros históricos iniciales se conservan debajo y no se mezclan con el inventario nuevo para evitar duplicados.

### Distribución provisional

- Altos: 19
- Medios o medios/altos: 39
- Bajos o bajos/medios: 7
- Informativos: 1
- Críticos confirmados en la pasada actual: 0

La matriz ejecutable completa vive en [`FORENSIC_REMEDIATION_MATRIX.md`](./FORENSIC_REMEDIATION_MATRIX.md).

## Dictamen por capa

| Capa | Estado | Dictamen |
|---|---|---|
| Event Bus | Productivo con riesgos | Requiere reintento seguro y estados de entrega. |
| Operational Ledger | Productivo con riesgos | Requiere errores observables, lotes atómicos y autoridad única frente al Store. |
| Timeline | Productivo parcial | Requiere retención por secuencia, reconciliación y fuente histórica explícita. |
| Passport | Productivo parcial | Requiere aislamiento organizacional, fechas deterministas e identidad vegetal persistente. |
| Knowledge Graph | Laboratorio | Implementado y probado, pero no montado; requiere política de autoridad, nodos ricos y API única. |
| Projection Engine | Laboratorio | Diseño sólido; no apto todavía para orquestación productiva por timeout no cancelable, checkpoints volátiles y cola vulnerable. |
| React / Store / Sync | Funcional con riesgos | Requiere reconciliación contra estado vigente y estrategia multiempresa explícita. |
| Quality / Supply chain | Incompleto | Falta lockfile, `npm ci`, cobertura, pruebas React reales y control de seguridad. |

## Orden obligatorio de saneamiento

### Bloque A — Protección inmediata de datos

`AUD-F005`, `AUD-F006`, `AUD-F007`, `AUD-F008`, `AUD-F042`, `AUD-F043`, `AUD-F044`, `AUD-F046`.

### Bloque B — Aislamiento multiempresa e identidad

`AUD-F016`, `AUD-F017`, `AUD-F018`, `AUD-F019`, `AUD-F022`, `AUD-F045`, `AUD-F048`.

### Bloque C — Timeline y Knowledge Graph

`AUD-F010`, `AUD-F011`, `AUD-F012`, `AUD-F013`, `AUD-F024`, `AUD-F025`, `AUD-F026`, `AUD-F028`, `AUD-F029`, `AUD-F030`.

### Bloque D — Projection Engine

`AUD-F032` a `AUD-F041`.

### Bloque E — Calidad, seguridad y operación

`AUD-F049`, `AUD-F050`, `AUD-F057`, `AUD-F058`, `AUD-F059` a `AUD-F066`, más los hallazgos medios y bajos diferidos de los bloques anteriores.

## Registros históricos previos

| ID histórico | Capa | Hallazgo | Severidad | Estado |
|---|---|---|---|---|
| AUD-001 | Git | La rama estuvo un commit detrás de `main` y el PR no era mergeable. | Alto | Cerrado: rama sincronizada. |
| AUD-002 | CI | Una prueba conservaba el texto obsoleto `Abrir planta`. | Bajo | Cerrado. |
| AUD-003 | Build | `MaterialPlantProfilePage.jsx` importaba una extensión inexistente. | Crítico | Cerrado y validado posteriormente. |
| AUD-004 | CI | Advertencia sobre runtime Node de acciones oficiales. | Medio | Abierto; se incorpora al saneamiento de CI. |

## Clasificación

- **Crítico:** corrupción activa, pérdida irreversible, exposición de credenciales administrativas, acceso indebido o imposibilidad de desplegar.
- **Alto:** riesgo de pérdida silenciosa, trazabilidad rota, contaminación multiempresa, identidad inestable o falsa idempotencia.
- **Medio:** inconsistencia arquitectónica, concurrencia incompleta, deuda técnica o operación deficiente.
- **Bajo:** mantenibilidad, nomenclatura, documentación o prevención.
- **Informativo:** estado real que debe quedar documentado, sin defecto inmediato.

## Decisiones permitidas

- **Conservar**
- **Corregir**
- **Consolidar**
- **Eliminar**
- **Diferir con criterio de entrada**

Ningún archivo se elimina por parecer antiguo. Primero se verifican imports, rutas, consumidores, datos persistidos, migraciones y compatibilidad.

## Criterio de salida de cada bloque

Un bloque solo queda certificado cuando:

1. Sus hallazgos altos están cerrados o bloqueados explícitamente.
2. Cada corrección tiene prueba directa del escenario de fallo.
3. Auditoría estática, suite y build terminan correctamente.
4. El PR permanece mergeable.
5. La matriz registra commit y Quality.
6. Una reauditoría independiente intenta reproducir nuevamente el defecto.

## Criterio final de la Foundation

No se registrarán Timeline, Passport y Knowledge Graph como proyectores productivos, ni se iniciarán Rule Engine o Workflow Engine, hasta que los bloques A–D estén certificados y la reauditoría final no encuentre regresiones altas abiertas.
