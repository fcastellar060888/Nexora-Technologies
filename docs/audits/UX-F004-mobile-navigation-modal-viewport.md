# UX-F004 — Navegación móvil y modales sin adaptación completa al viewport

## Estado

Corregido en código. Pendiente de validación visual en despliegue real.

## Evidencia

La barra superior concentraba búsqueda, presencia, estado de datos, sincronización y versión en una sola fila. En pantallas estrechas estos controles competían por espacio y podían reducir excesivamente el título o la búsqueda.

El panel lateral móvil:

- no bloqueaba el scroll del documento situado detrás;
- no se cerraba con la tecla Escape;
- no declaraba la relación entre el botón de apertura y el panel controlado.

Los modales utilizaban alturas basadas en `vh` y márgenes fijos, sin contemplar correctamente:

- viewport dinámico de Safari móvil;
- barra inferior del navegador;
- notch y safe areas;
- encabezado accesible durante formularios largos.

## Corrección

### Navegación

- bloqueo temporal del scroll del `body` mientras el menú móvil está abierto;
- cierre mediante `Escape`;
- restauración segura del estilo previo al desmontar;
- `aria-controls` e identificador estable del panel;
- ancho limitado por viewport y safe areas;
- encabezado del menú fijo durante desplazamiento;
- reducción de telemetría secundaria en móvil para proteger acciones primarias.

### Búsqueda y topbar

- ancho flexible y acotado;
- fuente de 16 px para evitar zoom automático en iOS;
- resultados desplegados dentro del viewport completo disponible;
- título con truncamiento controlado, no desbordamiento.

### Modales

- uso de `100dvh`;
- safe areas superiores, laterales e inferiores;
- modal de pantalla completa en teléfonos;
- encabezado sticky;
- zona inferior reservada para acciones y barras del navegador;
- scroll contenido y momentum scrolling en WebKit.

## Commits

- CSS responsive: `2a7f8ac81d634a23825f626d19ecb9654848ffea`
- comportamiento AppShell: `1049c35acaa62f8e46b37ded25a7e1086416b7c0`

## Criterios de aceptación

1. El topbar no genera scroll horizontal a 320, 375, 390 y 430 px.
2. El menú abre y cierra por botón, scrim, enlace y tecla Escape.
3. El contenido de fondo no se desplaza mientras el menú está abierto.
4. Los resultados de búsqueda permanecen dentro del viewport.
5. Los modales ocupan correctamente el viewport dinámico en Safari iOS.
6. El botón de cierre del modal permanece visible.
7. Las acciones inferiores no quedan ocultas por la barra del navegador.
8. No existen regresiones en tablet ni escritorio.

## Matriz de reauditoría

- iPhone Safari: 375, 390 y 430 px.
- Android Chrome: 360 y 412 px.
- iPad Safari vertical y horizontal.
- Escritorio: 1280, 1440 y 1920 px.
- Navegación por teclado: Tab, Shift+Tab y Escape.
