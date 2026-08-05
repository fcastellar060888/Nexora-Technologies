# UX-F006 — Objetivos táctiles insuficientes y scroll competitivo en mapas

## Estado

Corregido en código. Pendiente de validación visual final en despliegue real.

## Evidencia

El mapa unificado utilizaba celdas de plantas y esquejes de aproximadamente 18–22 px. En móvil y tablet esto hacía difícil seleccionar una unidad concreta sin tocar una adyacente. El canvas, los grids internos y el drawer lateral también podían competir por el desplazamiento táctil.

## Riesgo

- selección accidental de plantas o esquejes;
- dificultad para abrir el Passport correcto;
- menor precisión en operaciones masivas;
- scroll encadenado entre mapa, grid, drawer y página;
- controles parcialmente cubiertos por safe areas de iOS.

## Saneamiento

- objetivos táctiles base aumentados;
- 32–36 px en tablet y 38–42 px en teléfono;
- estados `selected` y `focus-visible` reforzados;
- scroll y overscroll contenidos en canvas, cuerpos y grids;
- `touch-action: manipulation` en celdas interactivas;
- drawer adaptado a `env(safe-area-inset-*)`;
- drawer de pantalla completa en teléfono;
- botón de cierre con altura táctil mínima de 44 px.

## Criterios de aceptación

1. Una planta o esqueje puede seleccionarse de forma confiable con un dedo.
2. La selección activa es visualmente inequívoca.
3. La navegación por teclado mantiene foco visible.
4. El scroll del grid no desplaza accidentalmente toda la página.
5. El drawer no queda debajo de barras del navegador ni del notch.
6. La unidad correcta abre su detalle o Passport.

## Matriz de reauditoría

- iPhone 375–430 px, Safari;
- Android 360–430 px, Chrome;
- iPad vertical y horizontal;
- escritorio con mouse y teclado;
- grids densos de plantas, bandejas y esquejes;
- selección individual, múltiple y estados de riesgo.

## Implementación

Commit productivo: `4f414efc81a771d0067c2128c321b30de3ac0d70`.
