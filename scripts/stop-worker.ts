import {createProjectClient} from "../packages/database/src/migrations.ts";
const db=await createProjectClient();
try{
 await db.query("BEGIN");await db.query("SELECT pg_advisory_xact_lock(742619040)");
 if((await db.query("SELECT 1 FROM control.operation_jobs WHERE status IN ('queued','running')")).rowCount)throw new Error("WORKER_BUSY");
 const result=await db.query(`SELECT pg_terminate_backend(a.pid) stopped FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
  WHERE l.locktype='advisory' AND l.classid=0 AND l.objid=742619038 AND l.granted
  AND a.datname=current_database() AND a.usename=current_user AND a.application_name='tornaguias-migrations' AND a.pid<>pg_backend_pid()`);
 await db.query("COMMIT");console.log(result.rowCount?"Worker local detenido para mantenimiento.":"No hay worker local activo.");
}catch{await db.query("ROLLBACK");console.error("No se detuvo el worker: hay trabajo pendiente o no está disponible.");process.exitCode=1;}finally{await db.end();}
