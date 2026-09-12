import { loadConfig } from "../../../packages/runtime/src/config.ts";
import {runOperations} from "./operations.ts";

try {
  loadConfig();
  console.log("Worker: configuración válida.");
  if (!process.argv.includes("--check")) {
    await runOperations(process.argv.includes("--once"));
  }
} catch {
  console.error("Worker: configuracion invalida. Revisa .env; no se muestran credenciales.");
  process.exitCode = 1;
}
