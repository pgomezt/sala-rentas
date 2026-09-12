# Observatorio de tornaguías

Estructura inicial para Cundinamarca. Aplicación web/API y procesamiento independientes, con PostgreSQL como fuente de consulta.

## Estado

Batch 3 cerrado técnicamente para uso local: captura y normalización independientes, API PostgreSQL, tablero de revisión y pantalla `/loads` para solicitar trabajos al worker, con historial y reintentos. Originales y duplicados conservados; sin publicación, autenticación ni despliegue. Ver [cierre y verificaciones](docs/batch-3-closeout.md), [normalización y revisión](docs/normalization-review.md) y [captura controlada](docs/ingestion.md). Los cambios todavía requieren commit/push.

## Organización

Etapas y requisitos de seguridad: [roadmap](docs/roadmap.md).

Modelo y migraciones: [docs/data-model.md](docs/data-model.md).

- `apps/web`: aplicación Next.js/React y API.
- `apps/worker`: procesador independiente Node.js/TypeScript.
- `packages/domain`: reglas de normalización y validación, independientes de infraestructura.
- `packages/contracts`: contratos entre aplicación y worker.
- `packages/database`: SQL, acceso a datos y migraciones.
- `packages/connectors`: adaptadores filesystem y, después, Drive.
- `packages/runtime`: carga y validacion de configuracion exclusiva del servidor.
- `docs`: arquitectura, decisiones, fuentes y configuración.
- `data`: archivos privados locales, excluidos de Git.
- `scripts`: comprobaciones de estructura y conexión.
- `tests`: pruebas de reglas, seguridad e integración.

## Inicio

Comandos y configuracion: ver [entorno de desarrollo](docs/development.md). Las dependencias ya estan instaladas en este equipo.

1. Seguir [PostgreSQL local](docs/postgresql-local.md).
2. Ejecutar `node scripts/check-structure.mjs`.
3. Con la base creada y `.env` configurado, ejecutar `node scripts/check-db.mjs`.

Los scripts iniciales no requieren instalar paquetes npm. El comprobador de conexión requiere `psql` en PATH y solo realiza una consulta de lectura.

Next.js, React, Graphile Worker, pg, TypeScript y SheetJS ya estan instalados. Los graficos se incorporaran cuando se implemente su funcionalidad.
