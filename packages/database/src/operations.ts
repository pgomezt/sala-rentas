import {createProjectClient} from "./migrations.ts";
import {InputError} from "./review.ts";
export async function operationsStatus(){
 const db=await createProjectClient(true);
 try{return {
  workerOnline:(await db.query("SELECT EXISTS(SELECT 1 FROM control.worker_state WHERE heartbeat_at>now()-interval '20 seconds') online")).rows[0].online as boolean,
  jobs:(await db.query("SELECT id,kind,status,retry_of,created_at,started_at,finished_at,error_code,progress FROM control.operation_jobs ORDER BY created_at DESC LIMIT 30")).rows,
  events:(await db.query("SELECT job_id,created_at,event FROM control.operation_events ORDER BY id DESC LIMIT 100")).rows,
 };}finally{await db.end();}
}
export async function enqueueOperation(kind:unknown,retry:unknown){
 if(!["scan","process"].includes(String(kind)))throw new InputError("Operación no válida.");
 if(retry!==undefined&&(typeof retry!=="string"||!/^[0-9a-f-]{36}$/i.test(retry)))throw new InputError("Reintento no válido.");
 const db=await createProjectClient();
 try{
  await db.query("BEGIN");await db.query("SELECT pg_advisory_xact_lock(742619040)");
  if((await db.query("SELECT 1 FROM control.operation_jobs WHERE status IN ('queued','running')")).rowCount)throw new InputError("Ya hay una operación pendiente o en ejecución.");
  if(retry && !(await db.query("SELECT 1 FROM control.operation_jobs WHERE id=$1 AND status='failed' AND kind=$2",[retry,kind])).rowCount)throw new InputError("Solo se reintentan operaciones fallidas del mismo tipo.");
  const job=(await db.query("INSERT INTO control.operation_jobs(kind,retry_of) VALUES($1,$2) RETURNING id",[kind,retry??null])).rows[0];
  await db.query("INSERT INTO control.operation_events(job_id,event) VALUES($1,'{\"phase\":\"QUEUED\"}')",[job.id]);
  await db.query("COMMIT");return job;
 }catch(e){await db.query("ROLLBACK");throw e;}finally{await db.end();}
}
