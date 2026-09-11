import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";

try {
  const config = parseEnv(await readFile(new URL("../.env", import.meta.url), "utf8"));
  if (!config.DATABASE_URL) throw new Error("missing");
  const url = new URL(config.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/tornaguias_dev" || url.search || url.hash ||
      !url.username || !url.password ||
      decodeURIComponent(url.password) === "REEMPLAZAR_PASSWORD") throw new Error("invalid");
  // libpq treats an empty PGSERVICE as a service name, not as disabled.
  const connectionEnv = { ...process.env };
  for (const key of Object.keys(connectionEnv)) {
    if (key.toUpperCase() === "PGSERVICE") delete connectionEnv[key];
  }
  const result = spawnSync("psql", ["-X", "-w", "-v", "ON_ERROR_STOP=1", "-At", "-c", "SELECT 1;"], {
    env: {
      ...connectionEnv,
      PGHOST: url.hostname,
      PGHOSTADDR: "127.0.0.1",
      PGPORT: url.port || "5432",
      PGDATABASE: "tornaguias_dev",
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGCONNECT_TIMEOUT: "5",
      PGOPTIONS: "-c default_transaction_read_only=on",
    },
    encoding: "utf8",
    timeout: 10000,
    windowsHide: true,
  });
  if (result.status !== 0 || result.stdout.trim() !== "1") {
    console.error("No se pudo verificar la conexión. Revisa psql, el servicio, la base y las credenciales. Se omiten detalles para no exponer secretos.");
    process.exitCode = 1;
  } else {
    console.log("Conexión verificada a tornaguias_dev mediante consulta de solo lectura.");
  }
} catch {
  console.error("Falta .env o su conexión no es válida. Consulta docs/postgresql-local.md. No se mostraron credenciales.");
  process.exitCode = 1;
}
