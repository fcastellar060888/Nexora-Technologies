# Cierre forense — AUD-F020

## Hallazgo

**AUD-F020 — Passport:** la deduplicación de secciones utilizaba una política implícita de “gana el primero”. Dos plugins podían aportar la misma identidad con contenidos contradictorios y el conflicto era descartado silenciosamente.

## Corrección

- La deduplicación calcula una huella canónica independiente del orden de propiedades.
- Duplicados estructuralmente idénticos convergen en una sola proyección.
- Una misma identidad con contenido diferente se rechaza como conflicto.
- La política aplica a relaciones, documentos, indicadores, riesgos, acciones y Timeline.
- El Passport no se construye parcialmente cuando existe una contradicción.

## Evidencia

- Contrato conflict-aware: `3e24ad45450afd5c84c5b595f07c13c10797fcb7`
- Pruebas contractuales: `30e29b4f267969a2f649c127332495a7e9c1d155`
- Reauditoría entre plugins: `46d4c186f04a50a2baa16c1681823cd89471c50e`

## Quality

- `#772`: **success**.
- `#774`: **success** tras la reauditoría cruzada de plugins.

## Dictamen

`AUD-F020` queda **cerrado y certificado**.
