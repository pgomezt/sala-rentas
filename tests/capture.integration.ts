import {mkdtemp,copyFile,unlink,rmdir} from "node:fs/promises";
import {resolve,join} from "node:path";
import assert from "node:assert/strict";
import {processFiles} from "../apps/worker/src/import-files.ts";
import {createProjectClient} from "../packages/database/src/migrations.ts";
import {findProjectRoot} from "../packages/runtime/src/config.ts";
import {within} from "../packages/connectors/src/filesystem.ts";
const root=findProjectRoot();const directory=await mkdtemp(join(root,"data/incoming/capture-test-"));
const target=resolve(directory,"capture-test.xls");const previous=process.env.SOURCE_DIRECTORY;
const db=await createProjectClient(true);
try{
 const source=(await db.query("SELECT original_storage_key FROM control.file_versions ORDER BY byte_size LIMIT 1")).rows[0];
 const before=(await db.query("SELECT count(*) n FROM raw.rows")).rows[0].n;
 await copyFile(resolve(root,source.original_storage_key),target);process.env.SOURCE_DIRECTORY=directory;
 await processFiles(true,"capture-test.xls",true);
 assert.equal((await db.query("SELECT count(*) n FROM raw.rows")).rows[0].n,before);
 console.log("Captura completa de archivo nuevo verificada y revertida; conteo original intacto.");
}finally{
 if(previous===undefined)delete process.env.SOURCE_DIRECTORY;else process.env.SOURCE_DIRECTORY=previous;
 await db.end();if(!within(resolve(root,"data/incoming"),directory)||!within(directory,target))throw new Error("UNSAFE_TEST_CLEANUP");await unlink(target);await rmdir(directory);
}
