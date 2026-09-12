import {createProjectClient} from "../packages/database/src/migrations.ts";
import {processFiles} from "../apps/worker/src/import-files.ts";
import {normalizeRows} from "../apps/worker/src/normalize-rows.ts";
import {listFiles} from "../packages/connectors/src/filesystem.ts";
import {findProjectRoot,loadConfig} from "../packages/runtime/src/config.ts";
import {spawn} from "node:child_process";
const db=await createProjectClient();
try{
 if(!(await db.query("SELECT pg_try_advisory_lock(742619039) locked")).rows[0].locked)throw new Error("TASK_ALREADY_RUNNING");
 const kind=process.argv[2];if(kind!=="scan"&&kind!=="process")throw new Error("INVALID_TASK");
 if(kind==="scan")await processFiles(false);
 else{
  const files=await listFiles(loadConfig().sourceDirectory);
  for(const file of files){
   const child=spawn(process.execPath,["--max-old-space-size=4096","scripts/import-one.ts",file.name],{cwd:findProjectRoot(),windowsHide:true,stdio:["ignore","inherit","ignore"]});
   const code=await new Promise<number|null>(r=>{child.once("error",()=>r(null));child.once("close",r);});
   if(code!==0)throw new Error("FILE_PROCESS_FAILED");
  }
  await normalizeRows();
 }
}catch{console.error("PROCESS_FAILED_OR_LIMIT");process.exitCode=1;}finally{await db.end();}
