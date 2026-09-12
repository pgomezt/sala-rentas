"use client";
import { useEffect,useState,useRef } from "react";
import {reviewRequest} from "../lib/review-client.ts";
import type { reviewData,recordDetail } from "../../../../packages/database/src/review.ts";
type Data=Awaited<ReturnType<typeof reviewData>>;
type Detail=NonNullable<Awaited<ReturnType<typeof recordDetail>>>;
const format=(value: unknown)=>new Intl.NumberFormat("es-CO",{maximumFractionDigits:0}).format(Number(value??0));
export default function Home(){
  const [data,setData]=useState<Data|null>(null);const [detail,setDetail]=useState<Detail|null>(null);
  const detailRef=useRef<HTMLElement>(null);
  useEffect(()=>{if(detail){detailRef.current?.scrollIntoView({block:"start"});detailRef.current?.focus();}},[detail?.record.id]);
  const [query,setQuery]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");
  useEffect(()=>{const controller=new AbortController();setBusy(true);setError("");
    reviewRequest({action:"search",filters:Object.fromEntries(new URLSearchParams(query))},controller.signal).then(setData).catch(e=>{if(e.name!=="AbortError")setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();},[query]);
  async function openRecord(id:string){setError("");setNotice("");try{setDetail(await reviewRequest({action:"detail",record:id}));}catch(e){setError((e as Error).message);}}
  const page=(offset:number)=>{const p=new URLSearchParams(query);p.set("page",String((data?.page??1)+offset));setQuery(p.toString());};
  return <main>
    <header><div><p className="eyebrow">CUNDINAMARCA / SALA RENTAS</p><h1>Observatorio de tornaguías</h1></div><span className="badge">REVISIÓN LOCAL</span></header>
    <nav><a href="/loads">Administrar cargas y ver progreso →</a></nav>
    <p className="notice">Datos preliminares. Originales y claves repetidas conservados. Ninguna carga está publicada.</p>
    <form className="filters" onSubmit={e=>{e.preventDefault();const p=new URLSearchParams();new FormData(e.currentTarget).forEach((v,k)=>{if(String(v))p.set(k,String(v));});setQuery(p.toString());setDetail(null);}}>
      <label className="wide">Carga<select name="run" key={data?.run} defaultValue={data?.run??""}>{data?.loads.map(l=><option key={l.id} value={l.id}>{l.dataset_kind} · {l.display_name} · {l.version}</option>)}</select></label>
      <label>Desde<input type="date" name="from"/></label><label>Hasta<input type="date" name="to"/></label>
      <label>Estado<select name="status"><option value="">Todos</option><option value="valid">Sin alertas mayores</option><option value="warning">Con advertencias</option><option value="quarantine">Cuarentena</option></select></label>
      {([['type','Tipo de tornaguía'],['origin','Origen'],['destination','Destino']] as const).map(([key,label])=><label key={key}>{label}<select name={key}><option value="">Todos</option>{(data?.options?.[key]??[]).map((v:string)=><option key={v}>{v}</option>)}</select></label>)}
      <label>Número completo<input name="q" placeholder="Incluye el prefijo 25" maxLength={100}/></label>
      <label>Incidencia<select name="rule"><option value="">Todas</option>{["INVALID_DATE","MISSING_DATE","INVALID_YEAR","EXTREME_QUANTITY","INVALID_NUMBER","MISSING_NUMBER","NEGATIVE_NUMBER","ZERO_NUMBER","REPEATED_KEY","DATE_ORDER","INVALID_DOCUMENT","UNIT_UNCONFIRMED","UNTRUSTED_CELL"].map(v=><option key={v}>{v}</option>)}</select></label>
      <button disabled={busy}>Aplicar filtros</button><button type="reset" className="secondary" onClick={()=>{setQuery("");setDetail(null);}}>Restablecer</button>
    </form>
    <div role="status" aria-live="polite">{busy?"Consultando…":notice}</div>{error&&<p role="alert" className="error">{error}</p>}
    {!busy&&!data?.summary&&!error&&<section><h2>Aún no hay cargas normalizadas</h2><p>Las cargas aparecerán al completar la normalización.</p></section>}
    {data?.summary&&<div aria-busy={busy} className={busy?"loading":""}>
      <div className="metrics"><article><span>Registros filtrados</span><strong>{format(data.summary.total)}</strong></article><article><span>En cuarentena</span><strong>{format(data.summary.quarantine)}</strong></article><article><span>Importes excluidos</span><strong>{format(data.summary.amount_excluded)}</strong></article><article><span>Sin fecha válida</span><strong>{format(data.summary.undated)}</strong></article></div>
      <p className="note">Fecha del filtro: legalización en LEG y expedición en REG. Importe declarado admitido técnicamente: {data.summary.amount===null?"sin valores elegibles":`${format(data.summary.amount)} COP`} ({format(data.summary.amount_included)} filas). No equivale a recaudo validado. Cantidades sin sumar: unidades pendientes de homologación.</p>
      <div className="charts"><section><h2>Registros por mes</h2><Bars rows={data.months}/></section><section><h2>Destinos con más registros</h2><p className="note">Primeros 12 · no representan necesariamente el total.</p><Bars rows={data.categories}/></section></div>
      <section><h2>Informe de calidad</h2><p className="note">Una fila puede tener varias incidencias. Los umbrales técnicos no son reglas legales.</p><div className="table-scroll"><table><thead><tr><th>Regla</th><th>Severidad</th><th>Incidencias</th></tr></thead><tbody>{data.issues.map(i=><tr key={i.rule_code}><td>{i.rule_code}</td><td>{i.severity}</td><td>{format(i.total)}</td></tr>)}</tbody></table></div></section>
      <section><h2>Detalle de registros</h2><p className="note">25 filas por página · selecciona un número para revisar la evidencia original.</p><div className="table-scroll"><table><thead><tr><th>Número</th><th>Fecha</th><th>Origen</th><th>Destino</th><th>Estado</th><th>Hoja / fila</th></tr></thead><tbody>{data.records.map(r=><tr key={r.id}><td><button className="link" onClick={()=>openRecord(r.id)}>{r.document_number_normalized??"SIN NÚMERO"}</button></td><td>{r.event_date??"—"}</td><td>{r.origin_label??"—"}</td><td>{r.destination_label??"—"}</td><td>{r.quality_status}</td><td>{r.sheet_name} / {r.row_number}</td></tr>)}</tbody></table></div>{!data.records.length&&<p>Sin registros para estos filtros.</p>}
      <nav className="pagination" aria-label="Paginación"><button className="secondary" disabled={data.page<=1||busy} onClick={()=>page(-1)}>Anterior</button><span>Página {data.page} de {Math.max(1,Math.ceil(data.summary.total/25))}</span><button className="secondary" disabled={data.page*25>=data.summary.total||busy} onClick={()=>page(1)}>Siguiente</button></nav></section>
    </div>}
    {detail&&<section ref={detailRef} tabIndex={-1} className="detail" aria-labelledby="record-title"><div className="section-head"><h2 id="record-title">Revisión · {detail.record.document_number_normalized}</h2><button className="secondary" onClick={()=>setDetail(null)}>Cerrar detalle</button></div>
      <p>Hoja {detail.record.sheet_name}, fila {detail.record.row_number}. Las propuestas no alteran el original ni aprueban la carga.</p>
      <form className="proposal" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setNotice("");try{await reviewRequest({action:"propose",issue:f.get("issue"),reason:f.get("reason"),value:f.get("value")});setNotice("Propuesta guardada. Pendiente de aprobación.");setDetail(await reviewRequest({action:"detail",record:detail.record.id}));form.reset();}catch(e){setError((e as Error).message);}}}>
        <label>Incidencia<select name="issue" required>{detail.issues.map(i=><option value={i.id} key={i.id}>{i.rule_code} · {i.field_name}</option>)}</select></label><label>Valor propuesto<input name="value" required maxLength={2000}/></label><label>Motivo<textarea name="reason" required minLength={5} maxLength={2000}/></label><button>Guardar propuesta</button>
      </form><ul>{detail.issues.map(i=><li key={i.id}><strong>{i.rule_code}</strong>: {i.message}</li>)}</ul>
      <h3>Historial de propuestas</h3>{detail.reviews.length?detail.reviews.map(r=><p key={r.id}>{new Date(r.created_at).toLocaleString("es-CO")} · {r.reason} · {r.proposed_value?.text}</p>):<p>Sin propuestas.</p>}
      <h3>Original frente a normalizado</h3><div className="table-scroll"><table><thead><tr><th>Columna</th><th>Original (descriptor)</th><th>Texto normalizado</th></tr></thead><tbody>{detail.record.headers.map((h:string,i:number)=><tr key={i}><td>{h}</td><td><code>{JSON.stringify(detail.record.cells[i])}</code></td><td>{String(detail.record.normalized_fields[h.normalize("NFC").trim().replace(/\s+/g," ").toLocaleUpperCase("es-CO")]??"—")}</td></tr>)}</tbody></table></div>
    </section>}
    <footer>Fuente: PostgreSQL local · revisión por carga, sin mezclar versiones · REG y LEG se analizan por separado.</footer>
  </main>;
}
function Bars({rows}:{rows:{label:string;total:number}[]}){const max=Math.max(1,...rows.map(r=>r.total));return <div className="bars">{rows.map(r=><div className="bar-row" key={r.label}><span>{r.label}</span><div className="track"><div style={{width:`${r.total/max*100}%`}}/></div><b>{format(r.total)}</b></div>)}</div>;}
