import test from "node:test";
import assert from "node:assert/strict";
import { planMigrations, type Migration } from "../packages/database/src/migrations.ts";
const files: Migration[] = [
  { name: "0001_first.sql", checksum: "a", sql: "" },
  { name: "0002_second.sql", checksum: "b", sql: "" },
];
test("una base nueva requiere todas las migraciones", () => assert.deepEqual(planMigrations(files, []), files));
test("repetir una carga de migraciones no repite DDL", () => assert.deepEqual(planMigrations(files, files), []));
test("rechaza cambios en SQL aplicado", () => assert.throws(() => planMigrations(files, [{ name: files[0]!.name, checksum: "changed" }])));
test("rechaza un historial desconocido", () => assert.throws(() => planMigrations(files, [{ name: "missing.sql", checksum: "a" }])));
test("rechaza aplicar migraciones antiguas fuera de orden", () => assert.throws(() => planMigrations(files, [files[1]!])));

