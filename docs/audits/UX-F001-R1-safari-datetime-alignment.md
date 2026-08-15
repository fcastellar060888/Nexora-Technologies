# UX-F001-R1 — Alineación inconsistente de fecha y hora en Safari/iOS

## Estado

Corregido en código. Pendiente de validación visual en el despliegue de Cloudflare Pages.

## Evidencia

En Safari privado sobre iPhone, el campo **Fecha y hora** de `InfrastructureOperationsPage.jsx` mostraba el valor de `input[type="datetime-local"]` centrado dentro del control (`ago 5, 2026, 11:34`), mientras el resto de los campos se alineaba al inicio.

La primera corrección de UX-F001 evitó el desbordamiento horizontal, pero no controló de forma suficiente los pseudo-elementos internos usados por WebKit para dibujar el valor.

## Causa

Safari/iOS renderiza los controles temporales mediante cajas internas independientes:

- `::-webkit-date-and-time-value`
- `::-webkit-datetime-edit`
- `::-webkit-datetime-edit-fields-wrapper`
- `::-webkit-calendar-picker-indicator`

El ancho del `input` exterior no garantiza la alineación del valor interno.

## Saneamiento

Se creó `src/styles/date-time-controls.css`, cargado después de los demás estilos globales, con:

- alineación explícita al inicio;
- layout flex de los segmentos internos WebKit;
- ancho y encogimiento controlados;
- indicador del calendario preservado;
- altura táctil mínima de 44 px en móvil;
- fuente de 16 px para impedir zoom automático;
- soporte de alto contraste.

## Prueba forense

`tests/ux-f001-r1-date-time-controls.test.mjs` verifica:

1. presencia de las reglas WebKit necesarias;
2. alineación `flex-start` y `text-align: start`;
3. carga de la hoja después de los estilos globales;
4. permanencia del `datetime-local` en la lectura ambiental.

## Criterios de cierre visual

- El valor de fecha/hora se alinea al inicio en Safari/iPhone.
- El control no desborda su tarjeta.
- El indicador del calendario sigue siendo visible y accionable.
- La selección nativa de fecha/hora abre correctamente.
- La apariencia es consistente en iPhone, iPad, Chrome y escritorio.
