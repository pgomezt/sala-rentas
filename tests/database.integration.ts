import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createProjectClient, readMigrations } from "../packages/database/src/migrations.ts";
import { findProjectRoot } from "../packages/runtime/src/config.ts";

const client = await createProjectClient();
let checks = 0;
async function rejects(sql: string, values: unknown[], code: string) {
  await client.query("SAVEPOINT expected_failure");
  let actual: string | undefined;
  try { await client.query(sql, values); }
  catch (error) { actual = (error as { code?: string }).code; }
  await client.query("ROLLBACK TO SAVEPOINT expected_failure");
  await client.query("RELEASE SAVEPOINT expected_failure");
  assert.equal(actual, code);
  checks++;
}
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = '15s'");
  await client.query("SET LOCAL lock_timeout = '5s'");
  if (process.argv.includes("--preview")) {
    for (const file of await readMigrations(resolve(findProjectRoot(), "packages/database/migrations"))) {
      await client.query(file.sql);
    }
  }
  const source = randomUUID(), file = randomUUID(), version = randomUUID(), otherVersion = randomUUID();
  const rule = randomUUID(), run = randomUUID(), nextRun = randomUUID();
  const row1 = randomUUID(), row2 = randomUUID(), otherRow = randomUUID();
  const record = randomUUID(), scope = "TEST/" + randomUUID();
  await client.query("INSERT INTO control.data_sources(id,name,kind,location) VALUES ($1,'TEST','filesystem','TEST_ONLY')", [source]);
  await client.query("INSERT INTO control.source_files(id,source_id,external_id,display_name) VALUES ($1,$2,'test.xls','test.xls')", [file, source]);
  for (const [id, hash] of [[version, "a"], [otherVersion, "b"]]) {
    await client.query("INSERT INTO control.file_versions(id,source_file_id,sha256,byte_size,original_storage_key) VALUES ($1,$2,$3,1,'TEST_ONLY')",
      [id, file, hash!.repeat(64)]);
  }
  await rejects("INSERT INTO control.file_versions(source_file_id,sha256,byte_size,original_storage_key) VALUES ($1,$2,1,'TEST_ONLY')", [file, "a".repeat(64)], "23505");
  await client.query("INSERT INTO control.rule_sets(id,name,version,definition) VALUES ($1,'TEST','1','{}')", [rule]);
  const createRun = async (id: string) => client.query(`INSERT INTO control.load_runs
    (id,file_version_id,rule_set_id,parser_version,idempotency_key,dataset_kind,scope_key,
      coverage_start,coverage_end,load_mode,status,started_at,finished_at,rows_read,rows_normalized)
    VALUES ($1,$2,$3,'test',$5,'REG',$4,'2025-01-01','2025-12-31','snapshot','running',now(),now(),2,2)`,
    [id, version, rule, scope, id]);
  await createRun(run);
  for (const [id, ver, number] of [[row1, version, 2], [row2, version, 3], [otherRow, otherVersion, 2]]) {
    await client.query("INSERT INTO raw.rows(id,file_version_id,sheet_name,row_number,headers,cells) VALUES ($1,$2,'enero',$3,'[\"number\"]','[\"25200001\"]')", [id, ver, number]);
  }
  await rejects("UPDATE raw.rows SET cells='[]' WHERE id=$1", [row1], "55000");
  await rejects("DELETE FROM raw.rows WHERE id=$1", [row1], "55000");
  await rejects("INSERT INTO raw.rows(file_version_id,sheet_name,row_number,headers,cells) VALUES ($1,'enero',2,'[]','[]')", [version], "23505");
  const insertRecord = async (id: string, runId: string, raw: string) => client.query(`INSERT INTO core.records
    (id,load_run_id,file_version_id,raw_row_id,dataset_kind,document_number_original,document_number_normalized,
      quantity,quantity_unit,declared_amount,quality_status,eligible_for_quantity,eligible_for_amount)
    VALUES ($1,$2,$3,$4,'REG','25200001','25200001',0,'TEST_UNIT',0,'valid',true,true)`,
    [id, runId, version, raw]);
  await insertRecord(record, run, row1);
  await insertRecord(randomUUID(), run, row2);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM core.records WHERE load_run_id=$1", [run])).rows[0].n, 2);
  checks++; // Identical business numbers in different source rows survive.
  await rejects("UPDATE core.records SET raw_row_id=$1 WHERE id=$2", [otherRow, record], "23503");
  await rejects("UPDATE core.records SET dataset_kind='LEG' WHERE id=$1", [record], "23503");
  await rejects("UPDATE core.records SET quantity_unit=NULL WHERE id=$1", [record], "23514");
  await rejects("UPDATE core.records SET quantity=-1 WHERE id=$1", [record], "23514");
  await rejects("UPDATE core.records SET quality_status='quarantine' WHERE id=$1", [record], "23514");
  await client.query("UPDATE core.records SET quantity=8600052246,eligible_for_quantity=false,quality_status='warning' WHERE id=$1", [record]);
  const summary = (await client.query("SELECT quantity_included::int,quantity_excluded::int,validated_quantity::text,validated_amount::text FROM analytics.load_summary WHERE load_run_id=$1", [run])).rows[0];
  assert.equal(summary.quantity_included, 1);
  assert.equal(summary.quantity_excluded, 1);
  assert.equal(Number(summary.validated_quantity), 0);
  assert.equal(Number(summary.validated_amount), 0);
  checks++;
  await rejects("INSERT INTO control.publications(dataset_kind,scope_key,load_run_id,published_by) VALUES ('REG',$1,$2,'TEST')", [scope, run], "23514");
  await client.query("UPDATE control.load_runs SET status='ready' WHERE id=$1", [run]);
  await client.query("INSERT INTO control.publications(dataset_kind,scope_key,load_run_id,published_by) VALUES ('REG',$1,$2,'TEST')", [scope, run]);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM analytics.expeditions WHERE load_run_id=$1", [run])).rows[0].n, 2); checks++;
  await rejects("UPDATE core.records SET invoice='changed' WHERE id=$1", [record], "55000");
  await rejects("UPDATE control.load_runs SET status='running' WHERE id=$1", [run], "55000");
  await createRun(nextRun);
  await insertRecord(randomUUID(), nextRun, row1);
  await client.query("UPDATE control.load_runs SET rows_read=1,rows_normalized=1,status='ready' WHERE id=$1", [nextRun]);
  await client.query("UPDATE control.publications SET load_run_id=$1 WHERE dataset_kind='REG' AND scope_key=$2", [nextRun, scope]);
  const active = (await client.query("SELECT load_run_id FROM analytics.expeditions WHERE load_run_id IN ($1,$2)", [run, nextRun])).rows;
  assert.equal(active.length, 1); assert.equal(active[0].load_run_id, nextRun); checks++;
  assert.equal((await client.query("SELECT count(*)::int AS n FROM core.records WHERE load_run_id=$1", [run])).rows[0].n, 2); checks++;
  await rejects("UPDATE core.records SET invoice='changed' WHERE id=$1", [record], "55000");
  assert.equal((await client.query("SELECT count(*)::int AS n FROM control.publication_events WHERE scope_key=$1", [scope])).rows[0].n, 2); checks++;
  console.log("Comprobaciones de integracion aprobadas: " + checks);
} catch (error) {
  const code = (error as { code?: string }).code;
  console.error("Prueba de integracion fallida; se revierte la transaccion. Codigo: " +
    (/^[A-Z0-9_]+$/.test(code ?? "") ? code : "ASSERTION_OR_UNKNOWN"));
  process.exitCode = 1;
} finally {
  await client.query("ROLLBACK");
  await client.end();
}
