import { loadConfig } from "../../../packages/runtime/src/config.ts";

try {
  loadConfig();
  console.log("Worker: configuracion valida. Modo inactivo; sin conexion a PostgreSQL ni consumo de trabajos.");
  if (!process.argv.includes("--check")) {
    // Graphile Worker is intentionally not started: run() can apply migrations.
    const idle = setInterval(() => {}, 60_000);
    const stop = () => { clearInterval(idle); console.log("Worker detenido."); };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  }
} catch {
  console.error("Worker: configuracion invalida. Revisa .env; no se muestran credenciales.");
  process.exitCode = 1;
}

