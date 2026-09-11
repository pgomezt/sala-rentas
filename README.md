# Observatorio de tornaguías

Estructura inicial para Cundinamarca. Aplicación web/API y procesamiento independientes, con PostgreSQL como fuente de consulta.

## Estado

Entorno local ejecutable: pagina de estado Next.js, endpoint de salud, worker inactivo y comandos de escaneo/captura. Tres migraciones aplicadas y 374559 filas originales capturadas de los dos Excel; sin normalizar ni publicar. Pasaron 17 pruebas unitarias, 19 comprobaciones de integracion y la reconciliacion de 24 hojas. Ver [captura controlada](docs/ingestion.md). Git inicializado y primer scaffold subido; los cambios posteriores requieren commit. Sin despliegue. La web no consulta datos todavia; las capturas se ejecutan explicitamente fuera del servidor web.

## Organización

Modelo y migraciones: [docs/data-model.md](docs/data-model.md).

- `apps/web`: futura aplicación Next.js/React y API.
- `apps/worker`: futuro procesador Node.js/TypeScript.
- `packages/domain`: reglas de normalización y validación, independientes de infraestructura.
- `packages/contracts`: contratos entre aplicación y worker.
- `packages/database`: SQL, acceso a datos y migraciones.
- `packages/connectors`: adaptadores filesystem y, después, Drive.
- `packages/runtime`: carga y validacion de configuracion exclusiva del servidor.
- `docs`: arquitectura, decisiones, fuentes y configuración.
- `data`: archivos privados locales, excluidos de Git.
- `scripts`: comprobaciones de estructura y conexión.
- `tests`: pruebas futuras de reglas e integración.

## Inicio

Comandos y configuracion: ver [entorno de desarrollo](docs/development.md). Las dependencias ya estan instaladas en este equipo.

1. Seguir [PostgreSQL local](docs/postgresql-local.md).
2. Ejecutar `node scripts/check-structure.mjs`.
3. Con la base creada y `.env` configurado, ejecutar `node scripts/check-db.mjs`.

Los scripts iniciales no requieren instalar paquetes npm. El comprobador de conexión requiere `psql` en PATH y solo realiza una consulta de lectura.

Next.js, React, Graphile Worker, pg, TypeScript y SheetJS ya estan instalados. Los graficos se incorporaran cuando se implemente su funcionalidad.
