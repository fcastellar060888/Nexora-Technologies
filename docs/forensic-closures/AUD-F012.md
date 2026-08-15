# Cierre forense — AUD-F012

## Hallazgo
El bridge del Timeline podía determinar igualdad con una comparación insuficiente o dependiente de serialización incidental, permitiendo omitir cambios de contenido o producir escrituras repetidas tras persistencia.

## Corrección
- Se introdujo una huella estructural canónica para entradas del Timeline.
- La comparación cubre todo el contenido, incluidos payload, metadata y presentación.
- El orden de propiedades no afecta la igualdad.
- La semántica reproduce el roundtrip JSON: propiedades `undefined` se omiten y `null` explícito permanece distinto.
- El orden y la longitud de la colección siguen siendo contractuales.

## Evidencia
- Implementación canónica: `1001a0dd69d839b8a884877a57ff5f25d4e9a98e`
- Integración en bridge: `7b89ed776bbce1d5da37fd97e2e172d06c5222b7`
- Export público: `f9616e138e1bc6acfc36f9a11f031a645ed723ea`
- Pruebas iniciales: `a41e9946e0843855d55ea2b4dcd53fd2507b7656`
- Semántica JSON corregida: `019985a961a865d97fc0fe4962e778d293db1f31`
- Pruebas finales: `8921d49fa201e2a285ffd1977d2f79af9ccdbe9d`

## Quality
- Quality técnico inicial `#840`: success.
- Quality técnico final `#844`: success.

## Resultado de reauditoría
La revisión posterior detectó y corrigió el caso `undefined` frente a propiedad ausente después de persistencia. No quedaron rutas conocidas donde un cambio significativo conserve igualdad ni donde un roundtrip JSON fuerce actualizaciones repetidas.

## Riesgo residual
Bajo. Las entradas del Timeline permanecen limitadas al contrato JSON canónico ya exigido por Domain Events y Ledger.
