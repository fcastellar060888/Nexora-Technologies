# UX-F001 — Desbordamiento de controles de fecha en móvil

## Estado

- Severidad: Media/Alta
- Tipo: UX, responsive, compatibilidad de navegador
- Evidencia: captura real en Safari/iOS suministrada durante la auditoría integral
- Corrección inicial: commit `4409e24e575da903073bc6687741b51a3cecdb60`
- Certificación visual: pendiente

## Descripción

Los controles nativos de fecha del formulario de activos/equipos exceden el ancho disponible en una vista móvil. El borde derecho queda fuera del contenedor y el formulario genera una composición visual inconsistente.

Los campos observados incluyen:

- Fecha de compra
- Garantía hasta

El defecto puede afectar cualquier `input` de tipo:

- `date`
- `datetime-local`
- `time`
- `month`
- `week`

## Causa técnica

Safari en iOS/iPadOS puede asignar anchura intrínseca a los segmentos internos de los controles temporales aunque el elemento exterior tenga `width: 100%`. La corrección previa no restringía todos los wrappers, pseudo-elementos WebKit ni los hijos de grids y formularios alternativos.

## Saneamiento aplicado

La hoja global `src/styles/responsive-fixes.css` ahora:

1. permite que campos y wrappers de ambos sistemas de formulario reduzcan su ancho;
2. aplica `box-sizing: border-box`, `min-width: 0` y `max-width: 100%` a controles;
3. restringe ancho físico y lógico de controles temporales;
4. neutraliza la anchura intrínseca de `::-webkit-date-and-time-value` y `::-webkit-datetime-edit`;
5. evita desbordamiento horizontal del documento en pantallas pequeñas;
6. conserva tamaño tipográfico de 16 px para impedir zoom automático de iOS.

## Criterios de aceptación

El hallazgo solo podrá cerrarse cuando se confirme que:

- ningún campo temporal excede su tarjeta o formulario;
- no existe desplazamiento horizontal involuntario;
- el valor y el indicador de calendario siguen siendo utilizables;
- el foco, teclado y selector nativo funcionan correctamente;
- no se afectan campos de texto, número, select ni textarea;
- el comportamiento es correcto con etiquetas largas y formularios de una o varias columnas.

## Matriz de reauditoría

- iPhone, Safari, ancho 375–430 px
- Android, Chrome, ancho 360–430 px
- iPad vertical y horizontal
- Chrome y Edge de escritorio
- Safari de escritorio cuando esté disponible

## Pendientes

1. Esperar Quality del commit de saneamiento.
2. Confirmar despliegue actualizado en Cloudflare Pages.
3. Repetir visualmente el formulario que produjo la evidencia.
4. Recorrer las demás pantallas con fechas, horas y periodos.
5. Registrar hallazgos independientes si existen problemas de densidad, safe area, teclado o acciones fijas.
