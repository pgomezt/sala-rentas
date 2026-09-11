# Base de datos

Acceso SQL parametrizado y migraciones versionadas. Se aplicaron 0001..0003 a tornaguias_dev. Desde la raiz: `node scripts/task.mjs db:status`, `db:migrate` o `db:test`. La ultima prueba usa una transaccion que se revierte. No editar SQL aplicado ni crear/alterar bases ajenas al proyecto. Ver docs/data-model.md y docs/ingestion.md.
