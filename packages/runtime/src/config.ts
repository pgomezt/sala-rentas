import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { parseEnv } from "node:util";

export class ConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = "ConfigurationError"; }
}
export interface RuntimeConfig {
  databaseUrl: string;
  sourceDirectory: string;
  originalsDirectory: string;
  quarantineDirectory: string;
}
export function findProjectRoot(start = process.cwd()): string {
  let current = resolve(start);
  for (;;) {
    try {
      const manifest = JSON.parse(readFileSync(resolve(current, "package.json"), "utf8"));
      if (manifest.name === "tornaguias") return current;
    } catch { /* Continue upwards without exposing file contents. */ }
    const parent = dirname(current);
    if (parent === current) throw new ConfigurationError("No se encontro la raiz del proyecto.");
    current = parent;
  }
}
export function parseConfig(values: Record<string, string | undefined>, root: string): RuntimeConfig {
  if ("window" in globalThis) throw new ConfigurationError("Configuracion exclusiva del servidor.");
  if (Object.entries(values).some(([key, value]) =>
    key.startsWith("NEXT_PUBLIC_") && /DATABASE|PASSWORD|SECRET|TOKEN/i.test(key) && value)) {
    throw new ConfigurationError("No publiques secretos mediante NEXT_PUBLIC_.");
  }
  const databaseUrl = values.DATABASE_URL;
  try {
    if (!databaseUrl || /REEMPLAZAR_PASSWORD|TU_PASSWORD/.test(databaseUrl)) throw new Error();
    const url = new URL(databaseUrl);
    if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/tornaguias_dev" || url.search || url.hash ||
      !url.username || !url.password) throw new Error();
    decodeURIComponent(url.password);
    decodeURIComponent(url.username);
  } catch {
    throw new ConfigurationError("DATABASE_URL debe apuntar a tornaguias_dev local con credenciales validas.");
  }
  const directory = (key: string, fallback: string) => {
    const value = values[key]?.trim() || fallback;
    return isAbsolute(value) ? resolve(value) : resolve(root, value);
  };
  return {
    databaseUrl: databaseUrl!,
    sourceDirectory: directory("SOURCE_DIRECTORY", "./docs"),
    originalsDirectory: directory("ORIGINALS_DIRECTORY", "./data/originals"),
    quarantineDirectory: directory("QUARANTINE_DIRECTORY", "./data/quarantine"),
  };
}
export function loadConfig(root = findProjectRoot(), environment = process.env): RuntimeConfig {
  let fileValues: Record<string, string | undefined> = {};
  try {
    fileValues = parseEnv(readFileSync(resolve(root, ".env"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new ConfigurationError("No se pudo leer la configuracion local.");
    }
  }
  // Explicit process settings take precedence; never mutate process.env or log secrets.
  return parseConfig({ ...fileValues, ...environment }, root);
}
