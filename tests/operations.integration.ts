import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {resolve} from "node:path";
import {enqueueOperation,operationsStatus} from "../packages/database/src/operations.ts";
import {createProjectClient} from "../packages/database/src/migrations.ts";
import {findProjectRoot} from "../packages/runtime/src/config.ts";
const root=findProjectRoot();
async function once(missing=false){const child=spawn(process.execPath,["apps/worker/src/index.ts","--once"],{cwd:root,windowsHide:true,stdio:"ignore",env:{...process.env,...(missing?{SOURCE_DIRECTORY:resolve(root,"data/incoming",`absent-test-${randomUUID()}`)}:{})}});const code=await new Promise(r=>{child.once("error",()=>r(-1));child.once("close",r);});assert.equal(code,0);}
const before=await operationsStatus();assert(!before.jobs.some(j=>["running","queued"].includes(j.status)),"Ya existe trabajo activo: no ejecutar prueba.");
const job=await enqueueOperation("scan",undefined);
await assert.rejects(()=>enqueueOperation("scan",undefined));
await once(true);
assert.equal((await operationsStatus()).jobs.find(j=>j.id===job.id)?.status,"failed");
const retry=await enqueueOperation("scan",job.id);await once();
assert.equal((await operationsStatus()).jobs.find(j=>j.id===retry.id)?.status,"succeeded");
const processJob=await enqueueOperation("process",undefined);await once();
assert.equal((await operationsStatus()).jobs.find(j=>j.id===processJob.id)?.status,"succeeded");
const interrupted=await enqueueOperation("scan",undefined);const db=await createProjectClient();
try{await db.query("UPDATE control.operation_jobs SET status='running',started_at=now() WHERE id=$1",[interrupted.id]);}finally{await db.end();}
await once();assert.equal((await operationsStatus()).jobs.find(j=>j.id===interrupted.id)?.error_code,"WORKER_INTERRUPTED");
console.log("Cola única, fallo persistente, reintento, procesamiento idempotente y recuperación OK. Cuatro operaciones diagnósticas quedan en historial.");
