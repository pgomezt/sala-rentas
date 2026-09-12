import {createProjectClient} from "../packages/database/src/migrations.ts";
const db=await createProjectClient(true);
try {
  if(process.argv.includes("--activity")) console.log((await db.query("SELECT pid,state,wait_event_type,wait_event,left(query,200) query,now()-query_start duration FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()")).rows);
  else {
    console.log(JSON.stringify((await db.query(`SELECT l.id,l.dataset_kind,l.status,l.rows_read,l.rows_normalized,
      (SELECT count(*) FROM core.records r WHERE r.load_run_id=l.id) actual,
      (SELECT count(*) FROM raw.rows r WHERE r.file_version_id=l.file_version_id) original
      FROM control.load_runs l JOIN control.rule_sets s ON s.id=l.rule_set_id WHERE s.name='normalization' ORDER BY l.dataset_kind`)).rows,null,2));
    console.log(JSON.stringify((await db.query(`SELECT l.dataset_kind,i.rule_code,i.severity,count(*) FROM quality.issues i JOIN control.load_runs l ON l.id=i.load_run_id JOIN control.rule_sets s ON s.id=l.rule_set_id WHERE s.name='normalization' GROUP BY 1,2,3 ORDER BY 1,2`)).rows,null,2));
    console.log("Publicaciones:",(await db.query("SELECT count(*) FROM control.publications")).rows[0].count);
  }
} finally {await db.end();}
