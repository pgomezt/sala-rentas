import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import { relative } from "node:path";
import { createProjectClient } from "../../../packages/database/src/migrations.ts";
import { findProjectRoot, loadConfig } from "../../../packages/runtime/src/config.ts";
import { listFiles, preserveOriginal, type SourceFile } from "../../../packages/connectors/src/filesystem.ts";
import { parseWorkbook, requireReader } from "../../../packages/connectors/src/workbook.ts";

type Seen = { external_id: string; sha256: string };
export function fileStatus(file: SourceFile, versions: Seen[]) {
  if (versions.some(v => v.external_id === file.name && v.sha256 === file.sha256)) return "KNOWN_CONTENT";
  if (versions.some(v => v.sha256 === file.sha256)) return "SAME_CONTENT_OTHER_NAME";
  if (versions.some(v => v.external_id === file.name)) return "CHANGED";
  return "NEW";
}
export async function processFiles(apply: boolean) {
  const root = findProjectRoot(), config = loadConfig(root);
  const sourcePath = await realpath(config.sourceDirectory);
  const files = await listFiles(sourcePath);
  const client = await createProjectClient(!apply);
  let locked = false;
  try {
    if (apply) {
      requireReader(); // Fail before any database or archive mutation if reader is unavailable.
      locked = (await client.query("SELECT pg_try_advisory_lock(742619036) AS locked")).rows[0].locked;
      if (!locked) throw new Error("IMPORT_ALREADY_RUNNING");
      if (!(await client.query("SELECT to_regclass('raw.workbooks') IS NOT NULL AS present")).rows[0].present) throw new Error("MIGRATIONS_REQUIRED");
    }
    const known: Seen[] = (await client.query(`SELECT f.external_id, v.sha256
      FROM control.data_sources s JOIN control.source_files f ON f.source_id=s.id
      JOIN control.file_versions v ON v.source_file_id=f.id
      WHERE s.kind='filesystem' AND s.location=$1`, [sourcePath])).rows;
    if (!files.length) console.log("No se encontraron XLS/XLSX en la carpeta de entrada (sin recorrer subcarpetas).");
    for (const file of files) {
      const status = fileStatus(file, known);
      console.log(JSON.stringify({file:file.name, status, bytes:file.size}));
      if (!apply) continue;
      const completed = await client.query(`SELECT l.id FROM control.load_runs l
        JOIN control.file_versions v ON v.id=l.file_version_id
        JOIN control.source_files f ON f.id=v.source_file_id
        JOIN control.data_sources s ON s.id=f.source_id
        WHERE s.location=$1 AND s.kind='filesystem' AND v.sha256=$2
          AND l.parser_version='sheetjs-0.20.3/raw-v1' AND l.status IN ('review','ready') AND l.finished_at IS NOT NULL
        LIMIT 1`, [sourcePath,file.sha256]);
      if (completed.rowCount) {
        console.log(JSON.stringify({file:file.name, result:"SKIPPED_ALREADY_CAPTURED"}));
        continue;
      }
      const started = performance.now();
      const archive = await preserveOriginal(file, config.originalsDirectory, root);
      // Scope releases workbook memory after each file; do not keep all workbooks in a collection.
      const result = await capture(file, archive);
      console.log(JSON.stringify({file:file.name, ...result, seconds:Math.round((performance.now()-started)/100)/10,
        rssMiB:Math.round(process.memoryUsage().rss/1024/1024)}));
      known.push({external_id:file.name,sha256:file.sha256});
    }
    async function capture(file: SourceFile, archive: string) {
      const workbook = parseWorkbook(archive);
      const expected = workbook.sheets.reduce((n,s)=>n+s.rowCount,0);
      const manifest = workbook.sheets.map(s=>({name:s.name, rows:s.rowCount, columns:s.headers.length}));
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL lock_timeout='5s'");
        let source = (await client.query("SELECT id,enabled FROM control.data_sources WHERE kind='filesystem' AND location=$1", [sourcePath])).rows;
        if (source.length > 1) throw new Error("AMBIGUOUS_SOURCE");
        if (source[0]?.enabled === false) throw new Error("SOURCE_DISABLED");
        const sourceId = source[0]?.id ?? (await client.query("INSERT INTO control.data_sources(name,kind,location) VALUES ('Excel local','filesystem',$1) RETURNING id", [sourcePath])).rows[0].id;
        const fileId = (await client.query(`INSERT INTO control.source_files(source_id,external_id,display_name)
          VALUES ($1,$2,$2) ON CONFLICT (source_id,external_id) DO UPDATE SET last_seen_at=now(),missing_since=NULL RETURNING id`,
          [sourceId,file.name])).rows[0].id;
        await client.query(`INSERT INTO control.file_versions(source_file_id,sha256,byte_size,original_storage_key,source_modified_at)
          VALUES ($1,$2,$3,$4,$5) ON CONFLICT (source_file_id,sha256) DO NOTHING`,
          [fileId,file.sha256,file.size,relative(root,archive),new Date(file.modifiedMs)]);
        const versionId = (await client.query("SELECT id FROM control.file_versions WHERE source_file_id=$1 AND sha256=$2", [fileId,file.sha256])).rows[0].id;
        await client.query(`INSERT INTO control.rule_sets(name,version,definition) VALUES
          ('raw_capture','1','{"normalize":false,"deduplicate_business_rows":false,"publish":false}')
          ON CONFLICT(name,version) DO NOTHING`);
        const ruleId = (await client.query("SELECT id FROM control.rule_sets WHERE name='raw_capture' AND version='1'")).rows[0].id;
        const key = versionId + "/sheetjs-0.20.3/raw-v1";
        const runId = randomUUID();
        await client.query(`INSERT INTO control.load_runs(id,file_version_id,rule_set_id,parser_version,idempotency_key,
          dataset_kind,scope_key,status,attempts,started_at)
          VALUES ($1,$2,$3,'sheetjs-0.20.3/raw-v1',$4,$5,$6,'running',1,now())`,
          [runId,versionId,ruleId,key,workbook.kind,"raw:"+versionId]);
        await client.query(`INSERT INTO raw.workbooks(file_version_id,reader_name,reader_version,date_system,sheet_manifest)
          VALUES ($1,'SheetJS',$2,$3,$4::jsonb)`, [versionId,workbook.readerVersion,workbook.dateSystem,JSON.stringify(manifest)]);
        let inserted = 0;
        let batch: unknown[] = [];
        const flush = async () => {
          if (!batch.length) return;
          const result = await client.query(`INSERT INTO raw.rows(file_version_id,sheet_name,row_number,headers,cells)
            SELECT $1, r.sheet_name,r.row_number,r.headers,r.cells FROM jsonb_to_recordset($2::jsonb)
              AS r(sheet_name text,row_number integer,headers jsonb,cells jsonb)`,
            [versionId,JSON.stringify(batch)]);
          inserted += result.rowCount ?? 0; batch = [];
        };
        for (const sheet of workbook.sheets) {
          for (const row of sheet.rows()) {
            batch.push({sheet_name:sheet.name,row_number:row.rowNumber,headers:sheet.headers,cells:row.cells});
            if (batch.length >= 500) await flush();
          }
          await flush();
          console.log(JSON.stringify({file:file.name,sheet:sheet.name,rows:sheet.rowCount,phase:"CAPTURE_IN_TRANSACTION"}));
        }
        if (inserted !== expected) throw new Error("ROW_COUNT_MISMATCH");
        await client.query("UPDATE control.load_runs SET rows_read=$2,status='review',finished_at=now() WHERE id=$1", [runId,inserted]);
        await client.query(`INSERT INTO quality.issues(load_run_id,rule_code,severity,message,details)
          VALUES ($1,'NORMALIZATION_PENDING','info','Captura original completa; normalizacion y publicacion pendientes.',$2::jsonb)`,
          [runId,JSON.stringify({reader:workbook.readerVersion,rows:inserted})]);
        await client.query("COMMIT");
        return {result:"RAW_CAPTURED_REVIEW_REQUIRED",kind:workbook.kind,rows:inserted,sheets:manifest.length,loadRunId:runId};
      } catch (error) { await client.query("ROLLBACK"); throw error; }
    }
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock(742619036)").catch(()=>{});
    await client.end();
  }
}

