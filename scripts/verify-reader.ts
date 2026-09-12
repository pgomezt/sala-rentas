import {resolve} from "node:path";
import {isDeepStrictEqual} from "node:util";
import {createProjectClient} from "../packages/database/src/migrations.ts";
import {findProjectRoot} from "../packages/runtime/src/config.ts";
import {parseWorkbook,workbookSheetNames} from "../packages/connectors/src/workbook.ts";
const db=await createProjectClient(true);const started=performance.now();let count=0;
try{
 const files=(await db.query("SELECT v.id,v.original_storage_key FROM control.file_versions v JOIN raw.workbooks w ON w.file_version_id=v.id ORDER BY v.id")).rows;
 for(const file of files){const path=resolve(findProjectRoot(),file.original_storage_key);const names=workbookSheetNames(path);
  for(let index=0;index<names.length;index++){
   async function verify(){const book=parseWorkbook(path,index);const sheet=book.sheets[0]!;const iterator=sheet.rows();let rows=0;
    await db.query("BEGIN READ ONLY");await db.query("DECLARE evidence NO SCROLL CURSOR FOR SELECT row_number,headers,cells FROM raw.rows WHERE file_version_id=$1 AND sheet_name=$2 ORDER BY row_number",[file.id,sheet.name]);
    while(true){const batch=await db.query("FETCH 500 FROM evidence");if(!batch.rowCount)break;for(const original of batch.rows){const row=iterator.next().value;if(!row||row.rowNumber!==original.row_number||!isDeepStrictEqual(sheet.headers,original.headers)||!isDeepStrictEqual(row.cells,original.cells))throw new Error("READER_MISMATCH");rows++;}}
    if(!iterator.next().done||rows!==sheet.rowCount)throw new Error("READER_COUNT_MISMATCH");
    await db.query("COMMIT");count+=rows;console.log(JSON.stringify({sheet:index+1,rows,phase:"VERIFIED",rssMiB:Math.round(process.memoryUsage().rss/1048576)}));
   }await verify();global.gc?.();
  }
 }
 console.log(JSON.stringify({verified:count,seconds:Math.round((performance.now()-started)/1000),maxRssMiB:Math.round(process.resourceUsage().maxRSS/1024)}));
}catch{console.error("Verificación del lector fallida; originales no modificados.");process.exitCode=1;}finally{await db.end();}
