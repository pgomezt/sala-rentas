import {spawn} from "node:child_process";
import {createInterface} from "node:readline";
import {createProjectClient} from "../../../packages/database/src/migrations.ts";
import {findProjectRoot} from "../../../packages/runtime/src/config.ts";
export async function runOperations(once=false){
 const db=await createProjectClient();let stopping=false;
 const stop=()=>{stopping=true;};process.once("SIGINT",stop);process.once("SIGTERM",stop);
 try{
  if(!(await db.query("SELECT pg_try_advisory_lock(742619038) locked")).rows[0].locked)throw new Error("WORKER_ALREADY_RUNNING");
  do{
   await db.query("INSERT INTO control.worker_state(id) VALUES(1) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now()");
   // An orphan child still processing owns this second lock. Never reclaim its job.
   let safe=true;const acquired:number[]=[];
   for(const lock of [742619039,742619036,742619037]){
    if((await db.query("SELECT pg_try_advisory_lock($1) locked",[lock])).rows[0].locked)acquired.push(lock);else{safe=false;break;}
   }
   for(const lock of acquired)await db.query("SELECT pg_advisory_unlock($1)",[lock]);
   if(!safe){if(once)break;await new Promise(r=>setTimeout(r,3000));continue;}
   await db.query(`WITH interrupted AS (UPDATE control.operation_jobs SET status='failed',error_code='WORKER_INTERRUPTED',finished_at=now() WHERE status='running' RETURNING id)
    INSERT INTO control.operation_events(job_id,event) SELECT id,'{"phase":"FAILED","code":"WORKER_INTERRUPTED"}' FROM interrupted`);
   const job=(await db.query("UPDATE control.operation_jobs SET status='running',started_at=now() WHERE id=(SELECT id FROM control.operation_jobs WHERE status='queued' ORDER BY created_at LIMIT 1) RETURNING id,kind")).rows[0];
   if(job){
    await db.query("INSERT INTO control.operation_events(job_id,event) VALUES($1,'{\"phase\":\"RUNNING\"}')",[job.id]);
    const child=spawn(process.execPath,["--max-old-space-size=2048","--expose-gc","scripts/operation-task.ts",job.kind],{cwd:findProjectRoot(),windowsHide:true,stdio:["ignore","pipe","ignore"]});
    let writes=Promise.resolve();let persistenceFailed=false;let eventCount=0;
    const timer=setInterval(()=>{writes=writes.then(async()=>{await db.query("UPDATE control.worker_state SET heartbeat_at=now() WHERE id=1");}).catch(()=>{persistenceFailed=true;child.kill();});},5000);
    const timeout=setTimeout(()=>child.kill(),30*60*1000);
    const lines=createInterface({input:child.stdout!});
    lines.on("line",line=>{
     if(line.length>4096||eventCount++>5000)return;
     let value:Record<string,unknown>;try{value=JSON.parse(line);}catch{return;}
     const safeEvent:Record<string,unknown>={};
     for(const key of ["file","status","bytes","result","kind","rows","sheets","sheet","phase","seconds","rssMiB"]){const v=value[key];if(typeof v==="number"&&Number.isFinite(v)||typeof v==="string"&&v.length<=250)safeEvent[key]=v;}
     if(!Object.keys(safeEvent).length)return;
     writes=writes.then(async()=>{await db.query("INSERT INTO control.operation_events(job_id,event) VALUES($1,$2)",[job.id,JSON.stringify(safeEvent)]);await db.query("UPDATE control.operation_jobs SET progress=$2 WHERE id=$1",[job.id,JSON.stringify(safeEvent)]);}).catch(()=>{persistenceFailed=true;child.kill();});
    });
    const code=await new Promise<number|null>(resolve=>{child.once("error",()=>resolve(null));child.once("close",resolve);});
    clearInterval(timer);clearTimeout(timeout);lines.close();await writes;
    const ok=code===0&&!persistenceFailed;
    await db.query("UPDATE control.operation_jobs SET status=$2,finished_at=now(),error_code=$3 WHERE id=$1",[job.id,ok?"succeeded":"failed",ok?null:"PROCESS_FAILED_OR_LIMIT"]);
    await db.query("INSERT INTO control.operation_events(job_id,event) VALUES($1,$2)",[job.id,JSON.stringify({phase:ok?"SUCCEEDED":"FAILED"})]);
   }
   if(!once&&!stopping)await new Promise(r=>setTimeout(r,3000));
  }while(!once&&!stopping);
 }finally{process.removeListener("SIGINT",stop);process.removeListener("SIGTERM",stop);await db.end();}
}
