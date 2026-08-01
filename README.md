# Nexora One

**Nexora One** es la plataforma empresarial de **Nexora Technologies** para gestionar operaciones agrícolas inteligentes mediante objetos identificables, eventos, relaciones, acciones y decisiones auditables.

## Arquitectura

La plataforma se construye sobre **Nexora OS**, un núcleo reutilizable e independiente de la interfaz que proporciona:

- identidad estable para objetos operativos;
- Domain Event Bus y Operational Ledger append-only;
- Timeline y Passport universal;
- workflows verificables;
- Knowledge Graph y genealogía;
- selección universal y acciones masivas seguras;
- aislamiento organizacional y compatibilidad con datos existentes.

## Estado del proyecto

La primera versión estable se desarrolla incrementalmente en el PR activo, con prioridad en:

1. identidad individual de abuelas y madres;
2. selección individual, múltiple y total;
3. ficha universal de planta;
4. integración con mapa unificado;
5. MIPE, fotografías y Timeline;
6. genealogía y acciones masivas seguras.

No se integran cambios que no superen la certificación automatizada.

## Requisitos

- Node.js `>=20.19.0`
- npm

## Desarrollo local

```bash
npm install
npm run dev
```

## Certificación

```bash
npm run check
```

La certificación ejecuta, en este orden:

1. auditoría estática;
2. suite automatizada;
3. build de producción.

El mismo comando se ejecuta en GitHub Actions mediante el workflow **Quality**.

## Identidad oficial

- **Empresa:** Nexora Technologies
- **Producto:** Nexora One
- **Núcleo:** Nexora OS
- **Repositorio:** `fcastellar060888/Nexora-Technologies`

## Política de compatibilidad

Las mejoras deben conservar compatibilidad con los datos existentes. Las migraciones destructivas y las decisiones de negocio no confirmadas quedan fuera del alcance de cambios incrementales.
