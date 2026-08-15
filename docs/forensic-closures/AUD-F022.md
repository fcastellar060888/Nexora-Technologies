# Cierre forense — AUD-F022

## Hallazgo

**AUD-F022 — Passport:** el aislamiento multiempresa dependía de que cada productor declarara voluntariamente `targetOrganizationId`. Una relación sin esa propiedad era aceptada y el Knowledge Graph completaba silenciosamente el tenant con la organización del objeto fuente.

## Corrección

- Toda relación del Passport exige `targetOrganizationId` no vacío.
- La empresa destino debe coincidir con `object.organizationId`.
- La identidad de deduplicación incluye la empresa destino.
- `passportRelationship()` exige la empresa destino en su contrato.
- Las proyecciones de plantas productivas, material vegetal y la fachada histórica declaran el tenant en cada relación.
- La proyección Passport → Knowledge Graph rechaza relaciones sin tenant y nunca lo infiere silenciosamente.
- Los fixtures históricos fueron actualizados para representar el contrato real; no se añadió fallback de compatibilidad.

## Evidencia

- Contrato estricto del Passport: `d012e06a17b60b693f93e3f34acca5665dbcb8d5`
- Fábrica de relaciones: `5ef55d3ff8104794670497fa3c842e940c658a5e`
- Proyección de plantas productivas: `8b1ab438c7d20fe6a900793379005f1790517eda`
- Proyección de material vegetal: `4c05ff8de3a104516345f3d4d7448ffd1c271a2a`
- Fachada histórica: `edfd918e6afde5e324f4562ef58bc4dd94497ed0`
- Guardia del Knowledge Graph: `839d0b6d337368df4f4222525993ea6c2da064e1`
- Pruebas adversariales: `869b42117a7c893db2da64f4f5731cb58874a7bd`
- Fixtures contractuales finales: `1fda5dbfdccc0c9d1002a19020a3e177bee3b5a6`

## Prueba directa

`tests/block-b-aud-f022-explicit-tenant.test.mjs` demuestra que:

1. Passport rechaza una relación sin empresa destino.
2. La fábrica rechaza omitir el tenant.
3. Una relación del mismo tenant se conserva con evidencia explícita.
4. Una relación hacia otra empresa se rechaza.
5. Knowledge Graph no rellena silenciosamente el tenant de un Passport crudo.
6. Las proyecciones productivas etiquetan todas sus relaciones.

## Quality

- `#740`: falló porque 20 fixtures históricos omitían el nuevo campo contractual; las pruebas nuevas y la implementación de AUD-F022 pasaron.
- `#752`: **success** sobre el estado técnico final; auditoría estática, 433 pruebas y build de producción en verde.

## Reauditoría independiente

Se revisaron el contrato, la fábrica, los productores de cultivo y material vegetal, la fachada histórica, la proyección Passport → Graph y los adaptadores del Knowledge Graph. No se encontró una ruta que acepte, infiera o escriba una relación sin tenant explícito.

## Riesgo residual

Los productores futuros deben proporcionar la empresa destino. El contrato falla de forma cerrada cuando esa evidencia falta o contradice al objeto fuente, por lo que una omisión no puede convertirse silenciosamente en una relación multiempresa válida.

## Dictamen

`AUD-F022` queda **cerrado y certificado**.
