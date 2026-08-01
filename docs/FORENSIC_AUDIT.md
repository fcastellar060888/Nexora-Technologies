# Auditoría forense de Nexora One

## Alcance

Esta auditoría revisa el estado real del producto hasta el commit fijado en la rama `foundation/event-bus-core`. El objetivo es estabilizar la plataforma antes de continuar el desarrollo, identificar deuda técnica, retirar código redundante, corregir incompatibilidades y proteger la trazabilidad funcional y de datos.

## Cadena de custodia

- Repositorio: `fcastellar060888/Nexora-Technologies`
- Rama estable: `main`
- Rama auditada: `foundation/event-bus-core`
- Pull Request principal: `#26`
- Commit inicial de auditoría: `a0dd26aded0e827fce732362ad7e300642be6ba4`
- Comando reproducible: `npm install --no-audit --no-fund && npm run check`
- Entorno declarado: Node.js `>=20.19.0`

Cada corrección posterior deberá registrar el commit, la evidencia, el riesgo mitigado y el resultado de Quality.

## Clasificación de hallazgos

- **Crítico:** riesgo de pérdida o corrupción de datos, exposición de credenciales, acceso indebido o imposibilidad de desplegar.
- **Alto:** rompe un flujo operativo principal, la trazabilidad o la compatibilidad histórica.
- **Medio:** duplicación, inconsistencia de arquitectura, deuda técnica o experiencia operativa deficiente.
- **Bajo:** nomenclatura, documentación, mantenimiento o mejora preventiva.

## Decisiones permitidas

- **Conservar:** cumple el contrato y tiene pruebas suficientes.
- **Corregir:** la capacidad es necesaria, pero su implementación presenta riesgo o inconsistencia.
- **Eliminar:** código muerto, duplicado, obsoleto o incompatible sin consumidores válidos.
- **Consolidar:** varias implementaciones deben quedar detrás de un único motor o contrato.
- **Diferir:** hallazgo válido sin impacto inmediato, registrado con criterio de entrada futuro.

Ningún archivo se elimina solo por parecer antiguo. Antes se verifican rutas, imports, consumidores, persistencia, migraciones y compatibilidad de datos.

## Orden de revisión

1. Repositorio, ramas, historial y PR.
2. Quality Gate y reproducibilidad del build.
3. Dependencias, versiones y cadena de suministro.
4. Configuración, secretos y despliegue.
5. Persistencia, migraciones y compatibilidad histórica.
6. Autenticación, autorización y aislamiento multiempresa.
7. Arquitectura del Core: Events, Ledger, Timeline, Workflow, Passport y Knowledge Graph.
8. Facility y Digital Twin.
9. Material vegetal, propagación y genealogía.
10. MIPE, MIRFE, riego y ambiente.
11. Biomasa, postcosecha, inventario, calidad y costos.
12. Interfaz, accesibilidad, navegación y experiencia de campo.
13. Rendimiento, tamaño del bundle y operación offline/realtime.
14. Cobertura de pruebas, escenarios faltantes y criterios de salida.

## Registro inicial

| ID | Capa | Hallazgo | Severidad | Decisión | Estado |
|---|---|---|---|---|---|
| AUD-001 | Git | La rama estaba un commit detrás de `main` y el PR no era mergeable. | Alto | Corregir | Cerrado: sincronizada sin pérdida funcional. |
| AUD-002 | CI | Una prueba conservaba el texto obsoleto `Abrir planta`. | Bajo | Corregir | Cerrado: actualizada a `Ver Passport`. |
| AUD-003 | Build | `MaterialPlantProfilePage.jsx` importaba `../services/store.js`, pero el archivo real es `store.jsx`. | Crítico | Corregir | Corregido; pendiente confirmación de Quality. |
| AUD-004 | CI | GitHub Actions advierte de la retirada de Node.js 20 en acciones oficiales. | Medio | Corregir | Pendiente de revisar versiones de actions y runtime objetivo. |

## Criterio de salida de cada bloque

Un bloque solo se considera certificado cuando:

1. Los hallazgos críticos y altos están cerrados o bloqueados explícitamente.
2. La auditoría estática termina correctamente.
3. Todas las pruebas pasan.
4. El build de producción termina correctamente.
5. El PR permanece mergeable.
6. Las decisiones y cambios quedan documentados.
