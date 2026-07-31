# Plan de prueba piloto

## Antes de comenzar
1. Ejecutar `npm run audit:static`.
2. Ejecutar `npm run build`.
3. Abrir `Diagnóstico del sistema`; debe indicar APTO PARA PRUEBA.
4. Descargar un respaldo JSON.

## Escenario mínimo
1. Crear empresa y sede.
2. Crear nave, cama y plantas.
3. Registrar análisis de agua vigente.
4. Crear productos y objetivo aprobado.
5. Calcular fórmula, revisar advertencias y aprobar con usuario Agrónomo/Administrador.
6. Crear preparación, orden y registrar aplicación.
7. Registrar monitoreo MIRFE posterior.
8. Registrar un hallazgo MIPE con seguimiento y foto.
9. Registrar entrada y salida de inventario.
10. Crear lote productivo y avanzarlo hasta empaque.
11. Registrar costos.
12. Revisar auditoría, dashboards e inteligencia.

## Criterios de aceptación
- Ningún saldo de inventario negativo.
- Ningún hallazgo sin planta válida.
- Ninguna fórmula aprobada por un rol no autorizado.
- Todos los registros conservan fecha, responsable y ubicación.
- Respaldo exportable y restaurable.
