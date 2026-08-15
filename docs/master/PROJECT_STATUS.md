# Nexora One — Estado maestro del proyecto

> Fuente de verdad operativa para continuar el proyecto entre sesiones y conversaciones.

## Identidad

- Empresa: **Nexora Technologies**
- Producto: **Nexora One**
- Núcleo: **Nexora OS**
- Repositorio: `fcastellar060888/Nexora-Technologies`
- Rama activa auditada: `foundation/event-bus-core`
- Pull Request principal: `#26`

## Objetivo del ciclo actual

Revisar integralmente todo lo programado, localizar y corregir defectos técnicos y funcionales, contrastar el producto contra los requisitos históricos definidos en los chats del proyecto y producir una hoja de ruta completa y verificable.

## Metodología obligatoria

1. Inspección forense.
2. Prueba que reproduzca el defecto.
3. Corrección mínima y compatible.
4. Quality: auditoría estática, pruebas y build.
5. Reauditoría independiente.
6. Registro del cierre y riesgos residuales.
7. Continuación a la siguiente capa.

Ningún hallazgo queda cerrado únicamente por inspección o porque el código parezca correcto.

## Estado técnico confirmado

### Base funcional existente

El repositorio ya contiene capacidades verificadas mediante pruebas para:

- Empresas, sedes, usuarios, roles y contexto organizacional.
- Event Bus, Operational Ledger y Timeline.
- Passport universal y objetos inteligentes.
- Knowledge Graph, genealogía y relaciones.
- Projection Engine y replay.
- Workflow básico.
- Persistencia local, sincronización, bootstrap remoto y coordinación entre pestañas.
- Abuelas, madres, esquejes, propagación y promoción.
- Mapa unificado de cultivo.
- MIPE, intervenciones y seguimientos.
- MIRFE, fórmulas, preparaciones y aplicaciones.
- Inventario y trazabilidad.
- Producción, poscosecha, reservas y ventas.

La existencia de una prueba no implica certificación funcional final; cada capacidad será contrastada contra los requisitos históricos.

## Saneamiento más reciente

### Knowledge Graph runtime

Se sustituyó el contador anónimo de retenciones por leases opacas por consumidor.

Garantías introducidas:

- Un consumidor solo libera su propia lease.
- Una lease no puede utilizarse dos veces.
- Una lease no puede liberar otro scope.
- La liberación administrativa se bloquea mientras haya consumidores activos.
- React StrictMode no destruye el repositorio durante desmontajes y montajes transitorios.

Commits principales:

- `112cfae6164862fcabe728b991a5541cb19aebeb`
- `f585830971bab42b246bbe49f022b7e4c046af2f`
- `8f8245f1fb8aed2cee4ac33ca3862f74b68bbefb`
- `9772c13933f8bd66829286992288ba660615c461`

### Projection Engine

Quality #1158 detectó que `replaySessionManager.js` no podía importarse por un error de parser. El archivo fue reescrito de manera completa y legible, conservando:

- inicio atómico de sesiones;
- aislamiento de observadores;
- cancelación;
- compactación de sesiones terminales;
- reportes de progreso.

Commit de corrección:

- `0fe8bea51e2497293859f0054da14ecb467cc214`

## Quality

Última ejecución analizada:

- Quality `#1158`
- Resultado: fallo
- Pruebas: 590
- Exitosas: 578
- Fallidas: 12
- Causa común: error de parser en `replaySessionManager.js`.
- Las pruebas nuevas de propiedad del Knowledge Graph pasaron.

Estado de la ejecución posterior a `0fe8bea…`: pendiente de registrar.

## Riesgos abiertos conocidos

### Calidad y cadena de suministro

- CI utiliza `npm install` en lugar de `npm ci`.
- Las dependencias utilizan rangos amplios.
- Debe confirmarse la existencia y vigencia del lockfile.
- No existe todavía cobertura con umbrales.
- La auditoría estática propia no reemplaza ESLint ni análisis de dependencias.
- GitHub Actions advierte que las acciones basadas en Node 20 se ejecutan forzadamente con Node 24.

### Gestión del cambio

El PR principal contiene cientos de commits y archivos modificados. Antes de integrarlo a `main` se requiere:

- Quality completamente verde;
- inventario funcional;
- análisis de compatibilidad;
- consolidación documental;
- plan de integración o partición del PR.

## Frentes de auditoría integral

1. Quality, sintaxis, build y pruebas.
2. Dependencias, lockfile, CI y seguridad.
3. Event Bus y Ledger.
4. Timeline, Passport y Knowledge Graph.
5. Projection Engine y Workflow.
6. Persistencia, sincronización y multiempresa.
7. Dominio agrícola y trazabilidad vegetal.
8. MIPE y MIRFE.
9. Inventario, producción y poscosecha.
10. UI, rutas, mapas y experiencia de usuario.
11. Contraste contra requisitos históricos.
12. Hoja de ruta y plan de entregas.

## Criterio para afirmar que el proyecto está revisado

La revisión integral terminará cuando:

- Quality esté verde y sea reproducible.
- No existan hallazgos críticos o altos abiertos.
- Cada módulo tenga estado funcional documentado.
- Todo requisito histórico esté clasificado como implementado, parcial, pendiente, descartado o sustituido.
- Exista una hoja de ruta priorizada y versionada.
- `NEXT_SESSION.md` permita reanudar sin depender de un chat anterior.
