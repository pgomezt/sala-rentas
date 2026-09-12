import assert from "node:assert/strict";
import {reviewData,recordDetail,InputError,proposeReview} from "../packages/database/src/review.ts";
import {createProjectClient} from "../packages/database/src/migrations.ts";
const all=await reviewData(new URLSearchParams());
assert.equal(all.loads.length,2);
for(const load of all.loads){
  const d=await reviewData(new URLSearchParams({run:load.id}));
  assert.equal(d.summary.total,Number(load.rows_read));
  assert.equal(d.months.reduce((a,r)=>a+r.total,0),d.summary.total);
  assert.equal(d.summary.amount_included+d.summary.amount_excluded,d.summary.total);
  const next=await reviewData(new URLSearchParams({run:load.id,page:"2"}));
  assert(!next.records.some(r=>d.records.some(p=>p.id===r.id)));
  const row=d.records[0]!;const detail=await recordDetail(row.id);assert(detail);assert.equal(detail.record.headers.length,detail.record.cells.length);
  const filtered=await reviewData(new URLSearchParams({run:load.id,q:row.document_number_normalized}));assert(filtered.records.every(r=>r.document_number_normalized===row.document_number_normalized));
}
await assert.rejects(()=>reviewData(new URLSearchParams({page:"-1"})),InputError);
await assert.rejects(()=>reviewData(new URLSearchParams({from:"2025-02-30"})),InputError);
await assert.rejects(()=>proposeReview({}),InputError);
const db=await createProjectClient();
try{
  const reconciliation=await db.query(`SELECT count(*) mismatches FROM control.load_runs l JOIN control.rule_sets s ON s.id=l.rule_set_id WHERE s.name='normalization' AND
    (l.rows_read<>(SELECT count(*) FROM core.records r WHERE r.load_run_id=l.id) OR EXISTS(SELECT 1 FROM raw.rows raw WHERE raw.file_version_id=l.file_version_id AND NOT EXISTS(SELECT 1 FROM core.records r WHERE r.load_run_id=l.id AND r.raw_row_id=raw.id)))`);
  assert.equal(reconciliation.rows[0].mismatches,"0");
  assert.equal((await db.query("SELECT count(*) FROM control.publications")).rows[0].count,"0");
  await db.query("BEGIN");
  const event=await db.query(`INSERT INTO quality.review_events(issue_id,action,reason,proposed_value,actor) SELECT id,'propose_correction','Prueba transaccional sin persistencia','{"text":"TEST"}','integration-test' FROM quality.issues LIMIT 1 RETURNING id`);
  assert.equal(event.rowCount,1);
  await db.query("ROLLBACK");
}finally{await db.end();}
console.log("Conciliación, filtros, paginación, detalle y revisión transaccional: OK. Sin publicaciones ni propuestas de prueba persistentes.");
