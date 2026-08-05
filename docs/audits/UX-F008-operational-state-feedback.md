# UX-F008 — Estados operacionales ambiguos

## Evidencia

La aplicación utiliza textos aislados, alertas nativas y estilos inline para comunicar estados vacíos, fallos y reintentos. Estos patrones no comparten jerarquía visual, semántica accesible ni comportamiento responsive.

## Riesgos

- El usuario puede interpretar una pantalla vacía como un fallo.
- Los errores persistentes pueden pasar desapercibidos.
- Los lectores de pantalla no reciben prioridades consistentes.
- Las acciones de recuperación no siempre son evidentes.
- Los avisos flotantes pueden interferir con barras móviles y safe areas.

## Saneamiento inicial

- Se creó `StateMessage` como patrón reusable para `empty`, `loading`, `error`, `success` e `info`.
- Se incorporaron roles `status` y `alert`, junto con `aria-live`.
- Se normalizaron títulos, mensajes y acciones de recuperación.
- El fallo de persistencia offline fue migrado desde estilos inline al patrón compartido.
- El aviso respeta safe areas, movimiento reducido y objetivos táctiles móviles.

## Criterios de aceptación

1. Todo error recuperable debe presentar una acción explícita.
2. Los estados vacíos deben explicar qué falta o cuál es el siguiente paso.
3. Los estados de carga deben comunicar actividad sin movimiento obligatorio.
4. Los avisos flotantes no deben quedar ocultos por barras de navegador.
5. Ningún estado debe depender exclusivamente del color.
6. Quality debe ejecutar la prueba `ux-f008-operational-state-feedback.test.mjs`.

## Estado

Saneamiento transversal iniciado. El patrón queda certificado primero en persistencia offline y se extenderá por familias de pantallas durante la auditoría funcional y visual.
