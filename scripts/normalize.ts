import { normalizeRows } from "../apps/worker/src/normalize-rows.ts";
try { await normalizeRows(); } catch { console.error("Normalización interrumpida; la carga incompleta se revirtió. Revisar conexión, migraciones y reglas."); process.exitCode=1; }
