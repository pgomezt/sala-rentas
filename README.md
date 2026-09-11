# Observatorio de tornaguías

Estructura inicial para Cundinamarca. Aplicación web/API y procesamiento independientes, con PostgreSQL como fuente de consulta.

## Estado

Solo scaffolding: no hay todavía pantallas, worker ejecutable, importaciones ni tablas creadas. No se han instalado dependencias ni conectado PostgreSQL. No hay despliegue ni repositorio Git inicializado.

## Organización

- `apps/web`: futura aplicación Next.js/React y API.
- `apps/worker`: futuro procesador Node.js/TypeScript.
- `packages/domain`: reglas de normalización y validación, independientes de infraestructura.
- `packages/contracts`: contratos entre aplicación y worker.
- `packages/database`: SQL, acceso a datos y migraciones.
- `packages/connectors`: adaptadores filesystem y, después, Drive.
- `docs`: arquitectura, decisiones, fuentes y configuración.
- `data`: archivos privados locales, excluidos de Git.
- `scripts`: comprobaciones de estructura y conexión.
- `tests`: pruebas futuras de reglas e integración.

## Inicio

1. Seguir [PostgreSQL local](docs/postgresql-local.md).
2. Ejecutar `node scripts/check-structure.mjs`.
3. Con la base creada y `.env` configurado, ejecutar `node scripts/check-db.mjs`.

Los scripts iniciales no requieren instalar paquetes npm. El comprobador de conexión requiere `psql` en PATH y solo realiza una consulta de lectura.

Las dependencias de Next.js, Graphile Worker, SheetJS y gráficos se incorporarán al implementar su primera funcionalidad, con versiones verificadas y lockfile.

