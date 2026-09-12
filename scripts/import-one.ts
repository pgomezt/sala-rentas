import {processFiles} from "../apps/worker/src/import-files.ts";
try{const name=process.argv[2];if(!name||name.includes("/")||name.includes("\\"))throw new Error("INVALID_FILE");await processFiles(true,name);}catch{console.error("FILE_PROCESS_FAILED");process.exitCode=1;}
