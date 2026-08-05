# UX-F003 — Tablas sin contención responsive uniforme

## Estado

Corregido en código. Pendiente de validación visual y de Quality.

## Evidencia

La aplicación usa al menos dos wrappers para tablas: `.table-scroll` y `.table-wrap`. Solo `.table-scroll` tenía estilos de overflow definidos en la hoja base. Varias páginas operativas usan `.table-wrap`, por lo que en pantallas estrechas una tabla ancha podía:

- expandir el ancho total de la página;
- quedar cortada por el viewport;
- ocultar la columna de acciones;
- producir desplazamiento horizontal global;
- dificultar el uso táctil de editar/eliminar.

## Saneamiento

Commit productivo: `da82ca7f02f61b92f17e35e6757d33608cf1755b`.

Se unificó el contrato responsive de `.table-wrap` y `.table-scroll`:

- overflow horizontal contenido dentro del wrapper;
- desplazamiento táctil con inercia;
- overscroll aislado;
- ancho mínimo controlado para conservar legibilidad;
- columna final de acciones fija al borde derecho;
- botones táctiles con dimensiones adecuadas en móvil;
- padding y tipografía compactados en teléfonos.

## Criterios de aceptación

1. Ninguna tabla debe ampliar el ancho de `body` o `#root`.
2. El desplazamiento horizontal debe ocurrir únicamente dentro del wrapper.
3. La columna de acciones debe permanecer visible al desplazar tablas anchas.
4. Los botones de acción deben ser utilizables con toque.
5. Encabezados y celdas deben seguir siendo legibles sin superposición.
6. El comportamiento debe validarse en 320, 375, 390, 430, 768, 1024, 1440 y 1920 px.

## Reauditoría requerida

- Activos e infraestructura.
- Inventario y movimientos.
- MIPE: incidentes, hallazgos y tratamientos.
- MIRFE: programas, monitoreo e historial.
- Producción y lotes.
- Auditoría, usuarios, costos y ventas.
- Safari iOS/iPadOS, Chrome Android y navegadores de escritorio.
