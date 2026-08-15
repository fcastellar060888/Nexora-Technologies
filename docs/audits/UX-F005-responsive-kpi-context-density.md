# UX-F005 — KPI, resúmenes y barras de contexto sin escala responsive uniforme

## Estado

Corregido en código. Pendiente de validación visual en despliegue real.

## Evidencia

Las vistas de Nexora One reutilizan varias familias de resumen y filtro:

- `.kpi-grid` y `.kpi-card`;
- `.summary-strip`;
- `.context-bar` con hasta seis controles;
- filtros y selectores operativos en dashboards y mapas.

La escala responsive anterior no era uniforme:

- la barra de contexto conservaba demasiadas columnas y posición sticky en tablet;
- algunas tarjetas caían demasiado pronto a una sola columna;
- otras conservaban dos columnas incluso en anchos donde el contenido dejaba de ser legible;
- valores grandes y etiquetas largas podían forzar el ancho de la tarjeta.

## Saneamiento

Commit productivo: `e7a3b994394ae753eb53c163854adec4b0e51dbd`.

Se aplicó:

1. reducción progresiva de la barra de contexto de tres a dos y finalmente una columna;
2. desactivación de su comportamiento sticky en tablet y móvil;
3. controles táctiles de 44 px y tipografía de 16 px en contextos móviles;
4. estrategia común de dos columnas para KPI y resúmenes en móviles normales;
5. una sola columna únicamente por debajo de 360 px;
6. protección de valores, etiquetas y tarjetas frente a desbordamientos;
7. tamaño numérico fluido mediante `clamp()`.

## Criterios de aceptación

- Ningún KPI, resumen o selector amplía el viewport.
- Los valores grandes permanecen dentro de sus tarjetas.
- Las etiquetas largas se leen sin recorte destructivo.
- La barra de contexto no cubre contenido ni ocupa una altura desproporcionada.
- Los controles son operables en iPhone, Android y tablet.
- En 375–430 px se conservan dos columnas cuando aportan densidad útil.
- En 320–360 px la disposición cambia a una columna legible.

## Matriz de reauditoría

- iPhone 320/360/375/390/430 px.
- Android 360/412 px.
- iPad 768/834 px vertical.
- Tablet 1024 px horizontal.
- Portátil 1280/1440 px.
- Safari, Chrome y Edge.

## Condición de cierre

El hallazgo se cerrará definitivamente cuando Quality permanezca verde y la validación visual del despliegue confirme los criterios anteriores.
