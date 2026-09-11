import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { findProjectRoot, loadConfig } from "../../runtime/src/config.ts";

export interface Migration { name: string; checksum: string; sql: string }
export interface AppliedMigration { name: string; checksum: string }
export class MigrationError extends Error {}

export async function readMigrations(directory: string): Promise<Migration[]> {
  const names = (await readdir(directory)).filter(name => name.endsWith(".sql")).sort();
  if (names.some(name => !/^\d{4}_[a-z0-9_]+\.sql$/.test(name))) {
    throw new MigrationError("Nombre de migracion no valido.");
  }
  if (new Set(names.map(name => name.slice(0, 4))).size !== names.length) {
    throw new MigrationError("Numeracion de migraciones repetida.");
  }
  return Promise.all(names.map(async name => {
    const sql = (await readFile(resolve(directory, name), "utf8")).replace(/\r\n/g, "\n");
    return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
  }));
}
export function planMigrations(files: Migration[], applied: AppliedMigration[]): Migration[] {
  const known = new Map(files.map(file => [file.name, file]));
  for (const record of applied) {
    if (!known.has(record.name) || known.get(record.name)!.checksum !== record.checksum) {
      throw new MigrationError("El historial no coincide con los archivos SQL; no se aplicaron cambios.");
    }
  }
  const done = new Set(applied.map(record => record.name));
  let pendingSeen = false;
  for (const file of files) {
    if (!done.has(file.name)) pendingSeen = true;
    else if (pendingSeen) throw new MigrationError("Migraciones fuera de orden.");
  }
  return files.filter(file => !done.has(file.name));
}
export async function createProjectClient(readOnly = false): Promise<pg.Client> {
  const client = new pg.Client({
    connectionString: loadConfig().databaseUrl,
    connectionTimeoutMillis: 5000,
    application_name: "tornaguias-migrations",
    options: readOnly ? "-c default_transaction_read_only=on" : "",
  });
  try {
    await client.connect();
    const result = await client.query("SELECT current_database() AS name");
    if (result.rows[0]?.name !== "tornaguias_dev") throw new MigrationError("Base de datos fuera de alcance.");
    return client;
  } catch (error) { await client.end().catch(() => {}); throw error; }
}
export async function migrate(apply: boolean): Promise<string[]> {
  const files = await readMigrations(resolve(findProjectRoot(), "packages/database/migrations"));
  const client = await createProjectClient(!apply);
  try {
    await client.query(apply ? "BEGIN" : "BEGIN READ ONLY");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    if (apply) await client.query("SELECT pg_advisory_xact_lock(742619035)");
    const exists = (await client.query("SELECT to_regclass('migration_meta.schema_migrations') IS NOT NULL AS present")).rows[0].present;
    if (!exists) {
      const conflicts = await client.query("SELECT nspname FROM pg_namespace WHERE nspname IN ('migration_meta','control','raw','core','quality','analytics')");
      if (conflicts.rowCount) throw new MigrationError("Hay esquemas existentes sin historial: revisar antes de migrar.");
    }
    const applied: AppliedMigration[] = exists
      ? (await client.query("SELECT name, checksum FROM migration_meta.schema_migrations ORDER BY name")).rows
      : [];
    const pending = planMigrations(files, applied);
    if (!apply) {
      await client.query("COMMIT");
      return files.map(file => (pending.includes(file) ? "PENDIENTE " : "APLICADA ") + file.name);
    }
    if (!exists) {
      await client.query("CREATE SCHEMA migration_meta");
      await client.query(`CREATE TABLE migration_meta.schema_migrations (
        name text PRIMARY KEY, checksum text NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
        applied_at timestamptz NOT NULL DEFAULT now(), applied_by text NOT NULL DEFAULT current_user
      )`);
    }
    for (const file of pending) {
      await client.query(file.sql);
      await client.query("INSERT INTO migration_meta.schema_migrations(name, checksum) VALUES ($1,$2)", [file.name, file.checksum]);
    }
    await client.query("COMMIT");
    return pending.length ? pending.map(file => "APLICADA " + file.name) : ["Sin migraciones pendientes."];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { await client.end(); }
}

