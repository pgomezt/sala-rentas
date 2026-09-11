# Worker

Proceso Node.js/TypeScript independiente. Desde la raiz: `node scripts/task.mjs dev:worker` valida configuracion y queda inactivo hasta Ctrl+C; `worker:check` valida y termina. Graphile Worker no se inicia automaticamente. La captura se ejecuta con `node scripts/task.mjs files:import` y el escaneo con `files:scan`, fuera de la web. No hay todavia consumidor de cola ni normalizador. Ver docs/ingestion.md.
