import { createProjectClient } from "./migrations.ts";
export class InputError extends Error {}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function reviewData(params: URLSearchParams) {
  const db = await createProjectClient(true);
  try {
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await db.query("SET LOCAL statement_timeout='20s'");
    const loads = (await db.query(`SELECT l.id,l.dataset_kind,l.status,l.rows_read,l.rows_normalized,f.display_name,s.version
      FROM control.load_runs l JOIN control.rule_sets s ON s.id=l.rule_set_id JOIN control.file_versions v ON v.id=l.file_version_id
      JOIN control.source_files f ON f.id=v.source_file_id WHERE s.name='normalization' AND l.status='review' ORDER BY l.created_at DESC,l.id`)).rows;
    const run = params.get("run") || loads[0]?.id;
    if (!run) return {loads,summary:null,records:[],issues:[],months:[],categories:[],options:{},page:1};
    if (!uuid.test(run) || !loads.some(l=>l.id===run)) throw new InputError("Carga no válida.");
    const page = Number(params.get("page") || 1);
    if (!Number.isInteger(page) || page<1 || page>1000000) throw new InputError("Página no válida.");
    const values: unknown[] = [run]; const conditions = ["r.load_run_id=$1"];
    const add = (sql: string,v: string) => {values.push(v); conditions.push(sql.replace("?",`$${values.length}`));};
    for (const [key,col] of [["status","quality_status"],["type","document_type"],["origin","origin_label"],["destination","destination_label"]]) {
      const v=params.get(key!); if(v) {if(v.length>250) throw new InputError("Filtro demasiado largo."); add(`r.${col}=?`,v);}
    }
    for(const [key,op] of [["from",">="],["to","<="]]) {const v=params.get(key!); if(v) {if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v) throw new InputError("Fecha no válida."); add(`COALESCE(r.legalization_date,r.expedition_date)${op}?::date`,v);}}
    if(params.get("from") && params.get("to") && params.get("from")!>params.get("to")!) throw new InputError("Rango de fechas invertido.");
    const q=params.get("q"); if(q) {if(q.length>100) throw new InputError("Número demasiado largo."); add("r.document_number_normalized=?",q.trim());}
    const rule=params.get("rule"); if(rule) {if(!/^[A-Z_]{1,60}$/.test(rule)) throw new InputError("Regla no válida.");add("EXISTS(SELECT 1 FROM quality.issues qi WHERE qi.record_id=r.id AND qi.rule_code=?)",rule);}
    const where=conditions.join(" AND ");
    const summary=(await db.query(`SELECT count(*)::int total,count(*) FILTER(WHERE quality_status='quarantine')::int quarantine,
      count(*) FILTER(WHERE eligible_for_amount)::int amount_included,count(*) FILTER(WHERE NOT eligible_for_amount)::int amount_excluded,
      sum(declared_amount) FILTER(WHERE eligible_for_amount)::text amount,
      count(*) FILTER(WHERE COALESCE(legalization_date,expedition_date) IS NULL)::int undated FROM core.records r WHERE ${where}`,values)).rows[0];
    if(page>Math.max(1,Math.ceil(summary.total/25)))throw new InputError("Página fuera del resultado.");
    const records=(await db.query(`SELECT r.id,r.document_number_normalized,r.document_year,r.document_type,r.quality_status,
      COALESCE(r.legalization_date,r.expedition_date)::text event_date,r.origin_label,r.destination_label,r.quantity::text,r.declared_amount::text,
      raw.sheet_name,raw.row_number FROM core.records r JOIN raw.rows raw ON raw.id=r.raw_row_id WHERE ${where} ORDER BY r.id LIMIT 25 OFFSET ${(page-1)*25}`,values)).rows;
    const months=(await db.query(`SELECT COALESCE(to_char(COALESCE(legalization_date,expedition_date),'YYYY-MM'),'SIN FECHA') label,count(*)::int total FROM core.records r WHERE ${where} GROUP BY 1 ORDER BY 1`,values)).rows;
    const categories=(await db.query(`SELECT COALESCE(destination_label,'SIN DESTINO') label,count(*)::int total FROM core.records r WHERE ${where} GROUP BY 1 ORDER BY 2 DESC,1 LIMIT 12`,values)).rows;
    const issues=(await db.query(`SELECT i.rule_code,i.severity,count(*)::int total FROM quality.issues i JOIN core.records r ON r.id=i.record_id WHERE ${where} GROUP BY 1,2 ORDER BY 3 DESC,1`,values)).rows;
    const opts=(await db.query(`SELECT jsonb_build_object('type',array_agg(DISTINCT document_type ORDER BY document_type) FILTER(WHERE document_type IS NOT NULL),
      'origin',array_agg(DISTINCT origin_label ORDER BY origin_label) FILTER(WHERE origin_label IS NOT NULL),
      'destination',array_agg(DISTINCT destination_label ORDER BY destination_label) FILTER(WHERE destination_label IS NOT NULL)) options FROM core.records WHERE load_run_id=$1`,[run])).rows[0].options;
    await db.query("COMMIT");
    return {loads,run,summary,records,months,categories,issues,options:opts,page};
  } finally {await db.end();}
}
export async function recordDetail(id: string) {
  if(!uuid.test(id)) throw new InputError("Registro no válido.");
  const db=await createProjectClient(true);
  try {
    const record=(await db.query(`SELECT r.id,r.document_number_normalized,r.document_year,r.quality_status,
      r.expedition_date::text,r.legalization_date::text,r.expiry_date::text,r.quantity::text,r.declared_amount::text,
      r.eligible_for_quantity,r.eligible_for_amount,r.eligible_for_timeliness,r.normalized_fields,
      raw.headers,raw.cells,raw.sheet_name,raw.row_number FROM core.records r JOIN raw.rows raw ON raw.id=r.raw_row_id WHERE r.id=$1`,[id])).rows[0];
    if(!record) return null;
    const issues=(await db.query("SELECT id,rule_code,field_name,severity,message FROM quality.issues WHERE record_id=$1 ORDER BY severity,rule_code",[id])).rows;
    const reviews=(await db.query("SELECT e.id,e.reason,e.proposed_value,e.created_at FROM quality.review_events e JOIN quality.issues i ON i.id=e.issue_id WHERE i.record_id=$1 ORDER BY e.created_at DESC LIMIT 100",[id])).rows;
    return {record,issues,reviews};
  } finally {await db.end();}
}
export async function proposeReview(body: Record<string, unknown>) {
  if(typeof body.issue !== "string"||!uuid.test(body.issue)||typeof body.reason!=="string"||body.reason.trim().length<5||body.reason.length>2000||typeof body.value!=="string"||!body.value.trim()||body.value.length>2000) throw new InputError("Indica una incidencia, propuesta y motivo (5–2000 caracteres).");
  const db=await createProjectClient();
  try {return (await db.query(`INSERT INTO quality.review_events(issue_id,action,reason,proposed_value,actor)
    SELECT id,'propose_correction',$2,jsonb_build_object('text',$3::text),'local-review' FROM quality.issues WHERE id=$1 RETURNING id`,[body.issue,body.reason.trim(),body.value])).rows[0] ?? null;}
  finally {await db.end();}
}
