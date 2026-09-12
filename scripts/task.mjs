import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const next = "node_modules/next/dist/bin/next";
const tsc = "node_modules/typescript/bin/tsc";
const tasks = {
  "dev:web": [next, "dev", "apps/web", "--hostname", "127.0.0.1", "--port", "3000"],
  "start:web": [next, "start", "apps/web", "--hostname", "127.0.0.1", "--port", "3000"],
  "dev:worker": ["--watch", "apps/worker/src/index.ts"],
  "start:worker": ["dist/apps/worker/src/index.js"],
  "worker:check": ["apps/worker/src/index.ts", "--check"],
  "typecheck:server": [tsc, "-p", "tsconfig.server.json", "--noEmit"],
  "typecheck:web": [tsc, "-p", "apps/web/tsconfig.json", "--noEmit"],
  "typecheck:tests": [tsc, "-p", "tsconfig.tests.json", "--noEmit"],
  "build:server": [tsc, "-p", "tsconfig.server.json"],
  "build:web": [next, "build", "apps/web", "--webpack"],
  "test": ["--test", "tests/config.test.ts", "tests/migrations.test.ts", "tests/import.test.ts", "tests/normalize.test.ts", "tests/security.test.ts"],
  "data:normalize": ["scripts/normalize.ts"],
  "files:scan": ["scripts/import.ts", "scan"],
  "files:import": ["--max-old-space-size=4096", "--expose-gc", "scripts/import.ts", "capture"],
  "worker:once": ["apps/worker/src/index.ts", "--once"],
  "db:status": ["scripts/database.ts", "status"],
  "db:migrate": ["scripts/database.ts", "migrate"],
  "db:test": ["tests/database.integration.ts"],
};
const sequences = {
  typecheck: ["typecheck:server", "typecheck:web", "typecheck:tests"],
  build: ["build:server", "build:web"],
  check: ["typecheck:server", "typecheck:web", "typecheck:tests", "test", "worker:check"],
};
const command = process.argv[2];
const sequence = sequences[command] || (tasks[command] ? [command] : null);
if (!sequence) { console.error("Comando desconocido."); process.exit(1); }
let child;
let stopping = false;
function stop(signal) {
  stopping = true;
  child?.kill(signal);
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
for (const task of sequence) {
  if (stopping) break;
  console.log("\n> " + task);
  const status = await new Promise(resolve => {
    child = spawn(process.execPath, tasks[task], {
      cwd: root, stdio: "inherit", windowsHide: true,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", TORNAGUIAS_BUILD: ["build:web","start:web"].includes(task) ? "1" : "0" },
    });
    child.once("error", () => { console.error("No se pudo iniciar el comando."); resolve(1); });
    child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  child = undefined;
  if (status !== 0) { process.exitCode = status; break; }
}
