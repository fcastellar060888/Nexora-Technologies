# UX-F002 — Densidad excesiva y acciones expuestas a la barra móvil

## Estado

Corregido en código. Pendiente de certificación visual y de Quality.

## Evidencia

En `InfrastructureOperationsPage.jsx`, los formularios de activos, mantenimiento y lecturas ambientales se apilan en una sola columna en móvil. La combinación de controles altos, separaciones amplias y formularios largos produce desplazamiento excesivo. Además, las acciones inferiores pueden quedar demasiado cerca de la barra del navegador de Safari/iOS.

## Impacto

- Mayor tiempo para completar tareas operativas.
- Riesgo de perder de vista la acción de guardar.
- Posible interferencia con la barra inferior del navegador y el área segura del dispositivo.
- Experiencia inconsistente entre iPhone, iPad y escritorio.

## Saneamiento aplicado

Commit: `1fbe35e0a2ba067117e29a04675bc558310498a3`

- Separación vertical reducida en formularios móviles.
- Controles táctiles conservados en un mínimo de 44 px.
- Textareas reducidas a una altura inicial más apropiada.
- Acciones de formulario fijadas al borde inferior durante el desplazamiento.
- Respeto de `env(safe-area-inset-bottom)`.
- Fondo translúcido y borde para mantener legibilidad sobre el contenido.

## Criterios de aceptación

1. Ningún botón de guardar queda oculto bajo la interfaz del navegador.
2. El formulario conserva objetivos táctiles de al menos 44 px.
3. No existe desplazamiento horizontal.
4. El desplazamiento vertical se reduce sin cortar etiquetas ni valores.
5. La barra de acciones no cubre el último campo del formulario.
6. El comportamiento es correcto en iPhone, Android, iPad vertical/horizontal y escritorio.

## Reauditoría requerida

- Safari iOS: 375, 390 y 430 px.
- Chrome Android: 360 y 412 px.
- iPadOS Safari: 768 y 834 px en vertical; 1024 px en horizontal.
- Chrome/Edge desktop: 1280, 1440 y 1920 px.
