# Nexora One — Punto de continuación

## Último estado confirmado

- Rama: `foundation/event-bus-core`
- PR: `#26`
- Quality certificada: `#1164`
- Resultado: `639/639` pruebas exitosas, auditoría estática OK y build de producción exitoso.
- Knowledge Graph Runtime certificado tras introducir leases por consumidor.
- Replay Ledger y Replay Session Manager certificados tras aislamiento de observadores e inicio atómico.

## Últimos commits relevantes

- `9772c13933f8bd66829286992288ba660615c461` — pruebas forenses de propiedad de leases.
- `0fe8bea51e2497293859f0054da14ecb467cc214` — saneamiento de Replay Session Manager.
- `80d38bc057b39528ba058a03634389425e65ec22` — expediente maestro inicial; Quality #1164 verde.
- `7e55ee0f5046abddeeaeed244532bf1216fa862c` — migración de Quality a Actions v6 y Node 24.
- `60f51b0165211dbe99fe6acaf70c91fec03faa66` — source maps de producción desactivados y vendor chunks separados.

## Hallazgos abiertos del bloque de cadena de suministro

1. No existe `package-lock.json`; todavía no es válido cambiar de `npm install` a `npm ci`.
2. Las dependencias directas conservan rangos semánticos amplios y deben revisarse junto con el lockfile real.
3. Falta una política explícita para `npm audit` y severidades aceptadas.
4. Falta cobertura instrumentada y umbrales graduales.
5. Falta revisar lint/type checking y pruebas de componentes.

## Próxima acción obligatoria

1. Consultar Quality del commit más reciente después de la migración a Node 24 y el nuevo particionado de Vite.
2. Corregir cualquier incompatibilidad confirmada sin introducir cambios funcionales.
3. Generar y versionar un `package-lock.json` completo con npm compatible; no crear uno manual o parcial.
4. Después del lockfile, cambiar CI a `npm ci` y habilitar caché por lockfile.
5. Añadir auditoría de dependencias con política explícita.
6. Diseñar cobertura y umbrales graduales.
7. Continuar con persistencia, sincronización, seguridad de sesión y configuración productiva.
8. Actualizar este archivo al terminar cada bloque.

## Regla de continuidad

En un chat nuevo, solicitar:

> Continuemos Nexora One desde `docs/master/NEXT_SESSION.md` y `docs/master/PROJECT_STATUS.md` en la rama `foundation/event-bus-core`.

Antes de modificar código, verificar que el head de la rama no haya cambiado y releer este punto de continuación.
