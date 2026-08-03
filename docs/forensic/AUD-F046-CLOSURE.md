# Cierre forense AUD-F046

## Hallazgo
El fallo al persistir la caché local era devuelto por `saveState()`, pero el Store ignoraba el resultado. El usuario podía continuar operando creyendo que los datos estaban guardados aunque la caché offline hubiese fallado.

## Corrección
- Se creó un registro de salud de persistencia externo al estado operativo.
- Cada intento registra estado, marca `dirty`, último error, último guardado exitoso y fallos consecutivos.
- `safeStorage` publica cada resultado a observadores sin depender de poder persistir el propio diagnóstico.
- Se montó un bridge global que muestra una alerta persistente con el detalle del fallo.
- La alerta ofrece un reintento explícito y desaparece únicamente después de una escritura exitosa.

## Commits
- Estado observable: `62051dfd72e586d701b6799b21c9dfdf8727164f`
- Publicación desde safeStorage: `ab6bcd13f93116952abb2e8b8853bcef96c4d986`
- Alerta y reintento: `2b4ce12f0526dbce05f804d17442245cef65b3f1`
- Montaje global: `49df5494a25cd26b598332adb78292e23c336aa5`
- Pruebas directas: `63c1afc1b39d9f2fb5bf0d0ad43d7a4e2fc7683d`

## Prueba directa
`tests/persistence-health.test.mjs` cubre fallo observable, acumulación de fallos, conservación del último guardado exitoso, recuperación mediante reintento y montaje del bridge visible.

## Quality
Workflow `Quality #564`: `success`.

## Reauditoría puntual
El diagnóstico no se guarda dentro del estado operativo y por tanto no depende del mecanismo que está fallando. Un error de persistencia ya no es silencioso y mantiene una señal `dirty` hasta una escritura confirmada.

## Riesgo residual
El navegador puede cerrarse antes del reintento y perder cambios no persistidos; el sistema ahora lo comunica explícitamente. La persistencia durable remota continúa siendo responsabilidad de la sincronización y sus hallazgos separados.
