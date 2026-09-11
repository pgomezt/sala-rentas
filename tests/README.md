# Pruebas

`node scripts/task.mjs test` ejecuta 17 pruebas de configuracion, salud, migraciones y deteccion/preservacion de archivos, sin conexiones a PostgreSQL. `node scripts/task.mjs check` agrega comprobacion de tipos y arranque de comprobacion del worker. `node scripts/task.mjs db:test` ejecuta 19 comprobaciones de integracion en tornaguias_dev con datos ficticios y rollback; requiere las migraciones aplicadas. La captura real se verifico contra 24 conteos de hojas y con un reintento sin filas adicionales; ver docs/ingestion.md.

## Pendientes para el pipeline

Reglas de nombres, identificadores, fechas, ceros, precisión decimal, detección de versiones, reintentos idempotentes y publicación atómica. No usar registros personales reales en fixtures versionados.
