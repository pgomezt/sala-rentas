import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { loadConfig, parseConfig, findProjectRoot } from "../packages/runtime/src/config.ts";
import { healthStatus } from "../packages/contracts/src/health.ts";

const root = resolve(".");
const valid = { DATABASE_URL: "postgresql://test:fake%40password@127.0.0.1:5432/tornaguias_dev" };
test("rutas relativas a la raiz, no al directorio del worker", () => {
  const config = parseConfig(valid, root);
  assert.equal(config.sourceDirectory, resolve(root, "docs"));
  assert.equal(config.originalsDirectory, resolve(root, "data/originals"));
});
test("conserva URL codificada sin modificar la contraseña", () => {
  assert.equal(parseConfig(valid, root).databaseUrl, valid.DATABASE_URL);
});
test("rechaza otras bases, hosts, marcadores y parametros sin filtrar secretos", () => {
  for (const value of ["", "postgresql://a:REEMPLAZAR_PASSWORD@localhost/tornaguias_dev",
    "postgresql://a:private-secret@localhost/otra",
    "postgresql://a:private-secret@example.com/tornaguias_dev",
    "postgresql://a:private-secret@localhost/tornaguias_dev?password=secret",
    "postgresql://a:%ZZ@localhost/tornaguias_dev"]) {
    assert.throws(() => parseConfig({ DATABASE_URL: value }, root), error => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes("private-secret"));
      return true;
    });
  }
});
test("rechaza secretos bajo NEXT_PUBLIC_", () => {
  assert.throws(() => parseConfig({ ...valid, NEXT_PUBLIC_DATABASE_URL: valid.DATABASE_URL }, root));
});
test("encuentra el monorepo desde apps/web", () => {
  assert.equal(findProjectRoot(resolve(root, "apps/web")), root);
});
test("variables explicitas prevalecen sobre .env sin alterar process.env", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "tornaguias-config-"));
  try {
    writeFileSync(resolve(directory, ".env"), 'DATABASE_URL="invalid"\nSOURCE_DIRECTORY="./source"\n');
    const before = process.env.DATABASE_URL;
    const config = loadConfig(directory, valid);
    assert.equal(config.databaseUrl, valid.DATABASE_URL);
    assert.equal(config.sourceDirectory, resolve(directory, "source"));
    assert.equal(process.env.DATABASE_URL, before);
  } finally { rmSync(directory, { recursive: true }); }
});
test("configuracion ausente falla sin mostrar contenido", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "tornaguias-missing-"));
  try { assert.throws(() => loadConfig(directory, {})); }
  finally { rmSync(directory, { recursive: true }); }
});
test("health no incluye credenciales, rutas ni una conexion a BD inventada", () => {
  assert.deepEqual(healthStatus(), { service: "web", status: "ok", configuration: "valid", database: "not_checked" });
});

