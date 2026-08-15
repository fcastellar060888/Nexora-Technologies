# UX-F007 — Foco, validación y feedback inconsistentes

## Severidad
Media/Alta.

## Evidencia
La aplicación contiene múltiples familias de botones, enlaces, campos, controles y mensajes, pero no existía una política transversal que garantizara:

- foco visible consistente para teclado;
- diferenciación clara de controles deshabilitados;
- estado visual de campos inválidos;
- presentación legible de mensajes de error y alertas;
- respeto por preferencias de movimiento reducido;
- compatibilidad básica con forced colors.

## Riesgo

- usuarios de teclado pueden perder la ubicación del foco;
- errores de formulario pueden pasar desapercibidos;
- acciones deshabilitadas pueden parecer activas;
- alertas de distinta naturaleza pueden verse iguales;
- animaciones y transiciones pueden afectar a usuarios sensibles al movimiento.

## Saneamiento

Se creó `src/styles/accessibility-fixes.css` y se cargó después de los estilos funcionales. Incluye:

- `:focus-visible` global para controles interactivos;
- foco de error específico para `aria-invalid` y `:user-invalid`;
- estados `disabled` y `aria-disabled` consistentes;
- estilos base para `role="alert"`, errores de campo y mensajes de validación;
- variantes visuales de error, advertencia, éxito e información;
- objetivos táctiles mínimos para controles compactos frecuentes;
- soporte de `prefers-reduced-motion`;
- soporte de `forced-colors`.

## Commits

- `e777053ba9d15b76abd66d3a739d3a0fd52000e0` — hoja global de accesibilidad.
- `723548f247299171155f1580bd2503e09fd33af9` — carga de la hoja después de los estilos de la aplicación.

## Criterios de aceptación

1. Todo control alcanzable por teclado muestra un foco visible.
2. El foco no depende únicamente de un cambio sutil de color.
3. Los campos con `aria-invalid="true"` muestran borde y halo de error.
4. Los controles deshabilitados no parecen accionables.
5. Los mensajes de error son legibles, no desbordan y conservan contraste.
6. Las preferencias de movimiento reducido son respetadas.
7. La interfaz conserva indicadores básicos bajo forced colors.
8. Auditoría estática, pruebas y build continúan en verde.

## Estado
Corregido en código. Pendiente de validación visual final con teclado, VoiceOver/NVDA y navegadores reales antes de certificación de producción.
