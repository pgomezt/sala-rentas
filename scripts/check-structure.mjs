import { access, readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const required = ["README.md", ".gitignore", ".env.example", "docs/postgresql-local.md", "apps/web/package.json", "apps/worker/package.json", "packages/domain/package.json", "packages/contracts/package.json", "packages/database/package.json", "packages/connectors/package.json"];
for (const path of required) await access(new URL(path, root));
for (const path of ["package.json", "tsconfig.base.json", ...required.filter(p => p.endsWith("package.json"))]) {
  JSON.parse(await readFile(new URL(path, root), "utf8"));
}
console.log("Estructura y manifiestos correctos. No se ha conectado la base.");

