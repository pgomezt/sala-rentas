import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const dryRun = process.argv.includes("--dry-run");
if (Number(process.versions.node.split(".")[0]) !== 24) {
  console.error("Este proyecto requiere Node.js 24.");
  process.exit(1);
}

// Use the npm bundled with Node, avoiding the broken user-level npm launcher.
const npmCli = [
  join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
  join(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
].find(existsSync);
if (!npmCli) {
  console.error("No se encontro npm junto a Node. Revisa la instalacion de Node.js.");
  process.exit(1);
}

const groups = [
  { workspace: null, dev: true, packages: ["typescript", "tsx", "@types/node", "@types/react", "@types/react-dom"] },
  { workspace: "apps/web", dev: false, packages: ["next", "react", "react-dom"] },
  { workspace: "apps/worker", dev: false, packages: ["graphile-worker"] },
  { workspace: "packages/database", dev: false, packages: ["pg"] },
  { workspace: "packages/database", dev: true, packages: ["@types/pg"] },
];

function run(args) {
  console.log(`npm ${args.join(" ")}`);
  if (dryRun) return;
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd: root, stdio: "inherit", windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    console.error("Instalacion interrumpida. Puedes repetir el comando tras resolver el error; no se actualizan versiones ya declaradas.");
    process.exit(result.status || 1);
  }
}

for (const group of groups) {
  const manifest = JSON.parse(readFileSync(join(root, group.workspace || "", "package.json"), "utf8"));
  const declared = { ...manifest.dependencies, ...manifest.devDependencies };
  const missing = group.packages.filter(name => !declared[name]);
  if (!missing.length) continue;
  const args = ["install", "--save-exact"];
  if (group.dev) args.push("--save-dev");
  if (group.workspace) args.push("--workspace", group.workspace);
  args.push(...missing);
  run(args);
}

// Reuse the recorded versions and restore missing packages after interruptions.
run(["install"]);
console.log(dryRun
  ? "Simulacion terminada: no se descargaron paquetes ni se modificaron archivos."
  : "Dependencias instaladas. Revisa y versiona los manifiestos y package-lock.json. No se ha conectado PostgreSQL.");
