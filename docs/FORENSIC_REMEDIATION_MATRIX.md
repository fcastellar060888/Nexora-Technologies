# Matriz de saneamiento forense

Estado inicial de todos los hallazgos: **Abierto**, salvo que se indique lo contrario. La severidad podrá ajustarse únicamente con evidencia nueva y debe quedar registrada en el historial del archivo.

## Convenciones

- **A:** protección inmediata de datos.
- **B:** aislamiento multiempresa e identidad.
- **C:** Timeline y Knowledge Graph.
- **D:** Projection Engine.
- **E:** calidad, seguridad y operación.
- **Diferido:** no bloquea el saneamiento inmediato, pero conserva criterio de entrada.

| ID | Capa | Severidad | Hallazgo resumido | Bloque | Decisión | Estado |
|---|---|---:|---|---|---|---|
| AUD-F001 | Git | Alto | El Core está 308 commits fuera de `main`. | E | Corregir estrategia de integración | Abierto |
| AUD-F002 | Quality | Medio | Auditoría estática limitada; sin ESLint, ciclos fiables, cobertura ni vulnerabilidades. | E | Ampliar | Abierto |
| AUD-F003 | Replay | Bajo/Medio | Progreso activo no conoce `selected` ni `remaining`. | D | Corregir | Abierto |
| AUD-F004 | Adopción | Informativo | Projection Engine existe como infraestructura aislada. | D | Conservar sin activar | Abierto |
| AUD-F005 | Event Bus | Alto | Un evento se deduplica antes de confirmar procesamiento y puede quedar imposible de reintentar. | A | Corregir | Abierto |
| AUD-F006 | Ledger | Alto | Errores de listeners se silencian completamente. | A | Corregir | Abierto |
| AUD-F007 | Ledger | Medio | `appendMany()` permite aplicación parcial. | A | Corregir | Abierto |
| AUD-F008 | React/Ledger | Medio | Rehidratación continua puede sobrescribir Ledger con snapshots atrasados. | A | Consolidar autoridad | Abierto |
| AUD-F009 | Events/Ledger | Bajo | Validaciones ambiguas de callbacks, límites, `clear()` y `maxHistory`. | E | Corregir | Abierto |
| AUD-F010 | Timeline | Alto | Orden y retención por `occurredAt` pueden eliminar eventos nuevos del Ledger. | C | Corregir | Abierto |
| AUD-F011 | Timeline | Medio | Mezcla entradas heredadas sin fuente explícita; no es proyección pura del Ledger. | C | Consolidar | Abierto |
| AUD-F012 | Timeline Bridge | Medio | Igualdad solo por `id` y `sequence`; cambios de contenido pueden no persistirse. | C | Corregir | Abierto |
| AUD-F013 | Timeline | Medio | Duplicado por `eventId` no puede reconciliar o enriquecer la entrada. | C | Corregir | Abierto |
| AUD-F014 | Timeline | Bajo/Medio | Inmutabilidad superficial al hidratar. | C | Corregir | Abierto |
| AUD-F015 | Timeline | Bajo | Camino directo al Event Bus y errores de observadores silenciosos. | C | Deprecar/corregir | Abierto |
| AUD-F016 | Passport | Alto | Ubicación y linaje se resuelven globalmente sin acotar por empresa/sede. | B | Corregir | Abierto |
| AUD-F017 | Identidad vegetal | Alto | Identidad virtual por lote e índice no representa una vida persistente. | B | Materializar entidades | Abierto |
| AUD-F018 | Passport/Replay | Alto | Uso del reloj actual hace proyecciones no deterministas. | B | Corregir | Abierto |
| AUD-F019 | Material vegetal | Medio | `updatedAt` no se propaga a unidades materializadas virtualmente. | B | Corregir | Abierto |
| AUD-F020 | Passport | Medio | Deduplicación “primero gana” oculta conflictos entre plugins/fuentes. | B | Definir merge | Abierto |
| AUD-F021 | Passport plugins | Medio | Plugins reciben estado/contexto congelados solo superficialmente. | B | Corregir | Abierto |
| AUD-F022 | Passport | Medio | Aislamiento multiempresa depende de declarar `targetOrganizationId`. | B | Endurecer contrato | Abierto |
| AUD-F023 | UI Passport | Medio | La UI traduce cualquier error del Passport como “planta no encontrada”. | E | Corregir manejo de errores | Abierto |
| AUD-F024 | Graph policy | Alto | Una fuente inferior con fecha posterior puede desplazar una fuente autoritativa. | C | Rediseñar precedencia | Abierto |
| AUD-F025 | Graph projection | Alto | El nodo principal descarta identidad, atributos y metadata de negocio. | C | Enriquecer modelo | Abierto |
| AUD-F026 | Graph legacy | Medio/Alto | `upsertNode()` heredado no actualiza nodos existentes. | C | Corregir/deprecar | Abierto |
| AUD-F027 | Graph edges | Medio | Clave semántica incluye vigencia y admite duplicados lógicos activos. | C | Rediseñar identidad | Abierto |
| AUD-F028 | Graph temporal | Medio | Relaciones obsoletas se eliminan en lugar de cerrarse temporalmente. | C | Corregir | Abierto |
| AUD-F029 | Graph repository | Medio | `replaceAll()` no valida versión esperada; riesgo de escritura perdida. | C | Añadir control optimista | Abierto |
| AUD-F030 | Graph API | Medio | Coexisten dos APIs públicas con reglas diferentes. | C | Consolidar | Abierto |
| AUD-F031 | Graph retention | Bajo/Medio | Retención de aristas no recoge nodos huérfanos normales. | C | Corregir | Abierto |
| AUD-F032 | Projection Engine | Alto | Timeout no cancela el proyector; puede escribir después del fallo. | D | Corregir | Abierto |
| AUD-F033 | Ledger adapter | Alto | Excepciones de callbacks pueden romper permanentemente la cola. | D | Corregir | Abierto |
| AUD-F034 | Projection Engine | Alto | Idempotencia solo en memoria; se pierde al reiniciar o escalar. | D | Persistir checkpoints | Abierto |
| AUD-F035 | Projection registry | Alto | Retiro de proyector puede dejar dependencias rotas. | D | Corregir | Abierto |
| AUD-F036 | Projection audit | Medio/Alto | `executionId` puede repetirse al recortar historial. | D | Corregir | Abierto |
| AUD-F037 | Projection memory | Medio | Checkpoints y sesiones crecen sin límite. | D | Compactar/persistir | Abierto |
| AUD-F038 | Projection Engine | Medio | `supports()` queda fuera de timeout y reintentos. | D | Endurecer contrato | Abierto |
| AUD-F039 | Projection metrics | Medio | `processed` mezcla ejecutados, omitidos y bloqueados. | D | Corregir semántica | Abierto |
| AUD-F040 | Projection health | Medio | Salud acumulada de por vida no refleja estado reciente. | D | Añadir ventanas | Abierto |
| AUD-F041 | Projection consistency | Medio | No existe modelo formal de consistencia parcial entre proyectores. | D | Formalizar eventual consistency | Abierto |
| AUD-F042 | Store bootstrap | Alto | Hidratación remota puede sobrescribir cambios locales concurrentes. | A | Corregir reconciliación | Abierto |
| AUD-F043 | Store sync | Alto | Resultado de sync basado en snapshot antiguo puede reemplazar cambios nuevos. | A | Corregir commit funcional | Abierto |
| AUD-F044 | Store/Ledger | Alto | Autoridad circular Store ↔ Ledger puede revertir el Ledger en memoria. | A | Consolidar autoridad | Abierto |
| AUD-F045 | Multiempresa | Medio/Alto | Bootstrap de una empresa reemplaza colecciones globales y puede borrar caché de otras. | B | Definir workspace | Abierto |
| AUD-F046 | Persistencia | Medio | Fallo de caché local se ignora en el Store y no se muestra al usuario. | A | Corregir | Abierto |
| AUD-F047 | Multitab | Medio | Otras pestañas reciben estado de sync, pero no invalidan datos operativos. | E | Corregir | Abierto |
| AUD-F048 | Runtime | Medio | Singletons sobreviven a cambios de empresa/usuario. | B | Runtime por organización | Abierto |
| AUD-F049 | React | Medio | No hay Error Boundaries para bridges, runtime y rutas. | E | Añadir | Abierto |
| AUD-F050 | Pruebas React | Bajo/Medio | Varias pruebas inspeccionan texto fuente, no ciclos reales. | E | Añadir integración | Abierto |
| AUD-F051 | Adopción | Alto | Projection Engine no está montado productivamente. | D | Mantener desactivado hasta certificar | Abierto |
| AUD-F052 | Adopción Graph | Alto | Knowledge Graph no tiene repositorio/runtime productivo único. | C | Integrar después de sanear | Abierto |
| AUD-F053 | PR | Medio/Alto | PR #26 es demasiado grande para revisión y reversión segura. | E | Segmentar saneamiento | Abierto |
| AUD-F054 | PR docs | Medio | Descripción del PR no refleja capacidades ni estado productivo real. | E | Actualizar | Abierto |
| AUD-F055 | Rutas | Medio | Rutas de producción redirigen a propagación, dominio no equivalente. | E | Sustituir por placeholder explícito | Abierto |
| AUD-F056 | Compatibilidad | Medio | Fachadas y APIs heredadas carecen de política de deprecación. | E | Documentar/consolidar | Abierto |
| AUD-F057 | Diagnóstico | Medio | Página de diagnóstico no incluye salud del Core. | E | Crear Core Health Registry | Abierto |
| AUD-F058 | Documentación | Bajo/Medio | Registro forense estaba desactualizado. | E | Corregir | Cerrado por documentación base |
| AUD-F059 | Dependencias | Alto | No existe `package-lock.json`; instalaciones no reproducibles. | E | Crear lockfile y usar `npm ci` | Abierto |
| AUD-F060 | CI Security | Medio/Alto | CI usa `npm install --no-audit`; no hay control de vulnerabilidades. | E | Separar Quality/Security | Abierto |
| AUD-F061 | Dependencias | Medio | Rangos amplios sin resolución fija. | E | Resolver con lockfile | Abierto |
| AUD-F062 | Cobertura | Medio | No hay medición ni umbral de cobertura. | E | Añadir cobertura | Abierto |
| AUD-F063 | Test discovery | Medio | Glob plano puede omitir pruebas en subdirectorios. | E | Hacer descubrimiento recursivo | Abierto |
| AUD-F064 | Build | Medio | Source maps públicos en producción. | E | Configurar por entorno | Abierto |
| AUD-F065 | Despliegue | Medio | Cloudflare, variables y rollback no están codificados/documentados suficientemente. | E | Añadir configuración y guía | Abierto |
| AUD-F066 | Seguridad sesión | Medio | Tokens de Supabase persistidos en `localStorage` amplifican riesgo XSS. | E | Mitigar con CSP/RLS/revisión | Abierto |

## Orden de ejecución del Bloque A

1. `AUD-F006`: hacer observables los errores del Ledger sin romper su aislamiento.
2. `AUD-F007`: convertir `appendMany()` en operación atómica.
3. `AUD-F005`: introducir estados de entrega y reintento seguro en Event Bus.
4. `AUD-F044` + `AUD-F008`: separar hidratación inicial de persistencia incremental del Ledger.
5. `AUD-F042`: reconciliar bootstrap remoto contra el estado vigente.
6. `AUD-F043`: aplicar resultados de sync mediante merge funcional.
7. `AUD-F046`: exponer salud de persistencia y datos pendientes de guardar.

## Evidencia de cierre

Cada fila cerrada debe agregar en una sección posterior:

```text
Hallazgo:
Commit:
Quality:
Prueba directa:
Resultado de reauditoría:
Riesgo residual:
```
