import { processFiles } from "../apps/worker/src/import-files.ts";
const command = process.argv[2];
if (!["scan","capture"].includes(command ?? "")) {
  console.error("Uso: node scripts/import.ts scan|capture"); process.exitCode=1;
} else {
  try { await processFiles(command === "capture"); }
  catch (error) {
    const message = (error as Error).message ?? "";
    const code = (error as {code?:string}).code ?? "";
    // Never echo arbitrary parser/SQL errors that could include original cells or connection strings.
    console.error("Operacion detenida: " + (/^[A-Z0-9_]{3,80}$/.test(message) ? message :
      /^[A-Z0-9_]{3,40}$/.test(code) ? code : "IMPORT_FAILED"));
    process.exitCode=1;
  }
}

