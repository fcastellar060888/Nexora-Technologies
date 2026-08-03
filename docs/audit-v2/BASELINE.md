# Nexora Technologies — Auditoría Forense Integral V2

## Baseline de certificación

**Fecha:** 2026-08-03  
**Rama:** `foundation/event-bus-core`  
**HEAD previo al baseline:** `97b710610309d55dfe2c0c6b19b053a311c36d15`  
**Producto:** Nexora One `7.0.0`

## Entorno declarado

- Sistema CI: GitHub Actions / `ubuntu-24.04`
- Node de aplicación: `20.19.0`
- npm: `10.8.2`
- Workflow: `.github/workflows/quality.yml`
- Timeout del job: 10 minutos

## Quality previo observado

La ejecución `Quality #1036` terminó en success, pero fue ejecutada sobre el merge temporal del PR #26 (`8e6d8032...`) que incorporaba el HEAD `97b71061...`, no sobre un checkout directo de la rama.

Resultados observados:

- auditoría estática: 183 archivos, OK;
- pruebas: 567 ejecutadas, 567 aprobadas, 0 fallidas;
- duración de pruebas: 6529.66 ms;
- build Vite: aprobado;
- módulos transformados: 1745;
- bundle JS principal: 711.76 kB (196.76 kB gzip);
- source map JS: 2532.73 kB;
- advertencia de chunk superior a 500 kB.

## Limitaciones conocidas del baseline

Estas condiciones se registran sin corregir durante la reauditoría del Bloque A:

1. Quality instala con `npm install --no-audit --no-fund`.
2. El script de pruebas usa el glob plano `tests/*.test.mjs`.
3. No se mide cobertura.
4. No existe todavía evidencia reproducible ligada a `npm ci` y lockfile dentro de esta certificación.
5. El build publica source maps y genera un chunk principal grande.
6. GitHub Actions advierte que las acciones basadas en Node 20 están siendo forzadas a Node 24 por deprecación del runtime de acciones.

Estas limitaciones pertenecen al Bloque E / operación y no invalidan por sí mismas la reauditoría funcional del Event Bus, pero reducen el alcance de lo que significa un Quality verde.

## Regla de certificación V2

El commit que incorpora este archivo será el primer `HEAD` oficial de la V2. Debe aprobar Quality directamente sobre `foundation/event-bus-core` antes de iniciar los ataques forenses del Bloque A.

Todo resultado posterior se clasificará como:

- **CERTIFICADO**: garantía revalidada sobre el código actual;
- **REGRESIÓN**: garantía previamente cerrada que volvió a fallar;
- **NUEVO**: defecto no registrado en la V1;
- **OBSERVACIÓN**: debilidad documentada sin impacto demostrado en la operación actual.
