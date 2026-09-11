import { migrate, MigrationError } from "../packages/database/src/migrations.ts";

const command = process.argv[2];
if (!["status", "migrate"].includes(command ?? "")) {
  console.error("Uso: node scripts/database.ts status|migrate");
  process.exitCode = 1;
} else {
  try {
    for (const line of await migrate(command === "migrate")) console.log(line);
  } catch (error) {
    const code = (error as { code?: string }).code;
    console.error(error instanceof MigrationError ? error.message :
      "Operacion de base de datos fallida. SQLSTATE: " + (/^[A-Z0-9]{5}$/.test(code ?? "") ? code : "no disponible"));
    process.exitCode = 1;
  }
}

