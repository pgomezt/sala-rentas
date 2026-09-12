import { randomUUID } from "node:crypto";
import { createProjectClient } from "../../../packages/database/src/migrations.ts";
import { normalize, RULE_VERSION } from "../../../packages/domain/src/normalize.ts";

export async function normalizeRows() {
  const db = await createProjectClient();
  const started = performance.now();
  try {
    if(!(await db.query("SELECT pg_try_advisory_lock(742619037) locked")).rows[0].locked)throw new Error("NORMALIZATION_ALREADY_RUNNING");
    const sources = await db.query(`SELECT l.*, w.date_system FROM control.load_runs l JOIN raw.workbooks w USING(file_version_id)
      JOIN control.rule_sets s ON s.id=l.rule_set_id WHERE s.name='raw_capture' AND l.status='review' ORDER BY l.id`);
    for (const source of sources.rows) {
      const key = `${source.file_version_id}/${RULE_VERSION}`;
      if ((await db.query("SELECT 1 FROM control.load_runs WHERE idempotency_key=$1",[key])).rowCount) { console.log(JSON.stringify({kind:source.dataset_kind,status:"already_normalized"})); continue; }
      await db.query("BEGIN");
      await db.query("SET LOCAL statement_timeout='120s'");
      try {
        const rule = await db.query(`INSERT INTO control.rule_sets(name,version,definition) VALUES ('normalization',$1,$2)
          ON CONFLICT(name,version) DO NOTHING RETURNING id`, [RULE_VERSION, JSON.stringify({uppercase:true,preserveDuplicates:true,preservePrefix:true,dateWindow:[2000,2030],quantityReviewThreshold:1000000,quantityUnits:"unconfirmed"})]);
        const ruleId = rule.rows[0]?.id ?? (await db.query("SELECT id FROM control.rule_sets WHERE name='normalization' AND version=$1",[RULE_VERSION])).rows[0].id;
        const run = randomUUID();
        await db.query(`INSERT INTO control.load_runs(id,file_version_id,rule_set_id,parser_version,idempotency_key,dataset_kind,scope_key,status,attempts,started_at,rows_read)
          VALUES($1,$2,$3,$4,$5,$6,$7,'running',1,now(),$8)`,[run,source.file_version_id,ruleId,source.parser_version,key,source.dataset_kind,source.scope_key,source.rows_read]);
        await db.query("DECLARE source_rows NO SCROLL CURSOR FOR SELECT id,headers,cells FROM raw.rows WHERE file_version_id=$1 ORDER BY sheet_name,row_number",[source.file_version_id]);
        let count = 0;
        while (true) {
          const batch = await db.query("FETCH 500 FROM source_rows"); if (!batch.rowCount) break;
          const records = []; const issues = [];
          for (const row of batch.rows) {
            const result = normalize(row.headers,row.cells,source.dataset_kind,source.date_system); const id = randomUUID();
            records.push({...result.record,id,load_run_id:run,file_version_id:source.file_version_id,raw_row_id:row.id});
            issues.push(...result.issues.map(i => ({...i,id:randomUUID(),load_run_id:run,record_id:id})));
          }
          // Populate only explicit columns: defaults and provenance guards remain in PostgreSQL.
          const columns = Object.keys(records[0]!);
          await db.query(`INSERT INTO core.records(${columns.join(",")}) SELECT ${columns.join(",")} FROM jsonb_populate_recordset(NULL::core.records,$1::jsonb)`,[JSON.stringify(records)]);
          if (issues.length) await db.query(`INSERT INTO quality.issues(id,load_run_id,record_id,rule_code,field_name,severity,message)
            SELECT id,load_run_id,record_id,rule_code,field_name,severity,message FROM jsonb_populate_recordset(NULL::quality.issues,$1::jsonb)`,[JSON.stringify(issues)]);
          count += batch.rowCount;
          if(count % 25000 === 0) console.log(JSON.stringify({kind:source.dataset_kind,phase:"NORMALIZING_IN_TRANSACTION",rows:count}));
        }
        await db.query("CLOSE source_rows");
        if (count !== Number(source.rows_read)) throw new Error("RECONCILIATION_FAILED");
        await db.query(`INSERT INTO quality.issues(load_run_id,record_id,rule_code,field_name,severity,message,details)
          SELECT $1,id,'REPEATED_KEY','document_number_normalized','warning','Clave repetida: todas las filas se conservan; no implica duplicado exacto.',jsonb_build_object('group_size',n)
          FROM (SELECT id,count(*) OVER(PARTITION BY document_year,document_number_normalized) n
            FROM core.records WHERE load_run_id=$1 AND document_number_normalized IS NOT NULL AND document_year IS NOT NULL) grouped WHERE n>1`,[run]);
        await db.query(`UPDATE core.records r SET quality_status='warning' WHERE load_run_id=$1 AND quality_status='valid' AND EXISTS(SELECT 1 FROM quality.issues i WHERE i.record_id=r.id AND i.rule_code='REPEATED_KEY')`,[run]);
        await db.query("UPDATE control.load_runs SET status='review',rows_normalized=$2,finished_at=clock_timestamp() WHERE id=$1",[run,count]);
        await db.query("COMMIT");
        console.log(JSON.stringify({kind:source.dataset_kind,run,rows:count,seconds:Math.round((performance.now()-started)/1000),rssMiB:Math.round(process.memoryUsage().rss/1048576)}));
      } catch (error) { await db.query("ROLLBACK"); throw error; }
    }
  } finally { await db.end(); }
}
