"use client";
import {useEffect,useState} from "react";
import type {operationsStatus} from "../../../../../packages/database/src/operations.ts";
type Status=Awaited<ReturnType<typeof operationsStatus>>;
const labels:Record<string,string>={queued:"En cola",running:"En ejecución",succeeded:"Completada",failed:"Fallida",scan:"Buscar archivos",process:"Capturar y normalizar"};
export default function Loads(){
 const [data,setData]=useState<Status|null>(null),[error,setError]=useState(""),[sending,setSending]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 async function refresh(){const r=await fetch("/api/operations");const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);}
 useEffect(()=>{let alive=true;let timer:ReturnType<typeof setTimeout>;const tick=async()=>{try{const r=await fetch("/api/operations");const d=await r.json();if(!r.ok)throw new Error(d.error);if(alive){setData(d);setError("");}}catch{if(alive)setError("No se pudo consultar el estado. Se reintentará.");}finally{if(alive)timer=setTimeout(tick,5000);}};void tick();return()=>{alive=false;clearTimeout(timer);};},[]);
 async function enqueue(kind:string,retry?:string){setSending(true);setError("");try{const r=await fetch("/api/operations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,retry})});const d=await r.json();if(!r.ok)throw new Error(d.error);setSelected(d.id);await refresh();}catch(e){setError((e as Error).message);}finally{setSending(false);}}
 const active=data?.jobs.some(j=>["queued","running"].includes(j.status));
 const jobId=selected??data?.jobs[0]?.id;
 return <main><header><div><p className="eyebrow">SALA RENTAS / OPERACIÓN LOCAL</p><h1>Cargas de archivos</h1></div><a href="/">Volver al análisis</a></header>
  <p className="notice">Solo la carpeta configurada en el servidor. Buscar no importa datos. Procesar captura los archivos nuevos o modificados y normaliza las capturas pendientes, sin publicar.</p>
  <section><h2>Procesamiento</h2><p role="status">{data?data.workerOnline?"Worker conectado":"Worker no disponible: las solicitudes permanecerán en cola":"Consultando estado…"}</p>
   <div className="actions"><button disabled={!data||active||sending} onClick={()=>enqueue("scan")}>Buscar archivos nuevos</button><button disabled={!data||active||sending} onClick={()=>enqueue("process")}>Capturar y normalizar carpeta</button></div>
   <p className="note">Una operación a la vez. Los archivos ya capturados se omiten. La actualización de estado es cada 5 segundos; no se buscan archivos automáticamente.</p>{error&&<p role="alert" className="error">{error}</p>}
  </section>
  <section><h2>Historial de operaciones</h2><div className="table-scroll"><table><thead><tr><th>Solicitud</th><th>Operación</th><th>Estado</th><th>Resultado / acción</th></tr></thead><tbody>{data?.jobs.map(j=><tr key={j.id}><td><button className="link" onClick={()=>setSelected(j.id)}>{new Date(j.created_at).toLocaleString("es-CO")}</button></td><td>{labels[j.kind]}</td><td>{labels[j.status]}</td><td>{j.error_code??(j.progress?.phase||j.progress?.result||"—")}{j.status==="failed"&&<button className="secondary" disabled={active||sending} onClick={()=>enqueue(j.kind,j.id)}>Reintentar</button>}</td></tr>)}</tbody></table></div>{data&&!data.jobs.length&&<p>Aún no hay operaciones.</p>}</section>
  <section><h2>Progreso y archivos detectados</h2><p className="note">Últimos eventos disponibles. Las filas informadas durante una captura todavía pueden revertirse si el archivo falla.</p><div className="table-scroll"><table><thead><tr><th>Hora</th><th>Archivo / hoja</th><th>Estado</th><th>Filas</th></tr></thead><tbody>{data?.events.filter(e=>e.job_id===jobId).map((e,i)=><tr key={i}><td>{new Date(e.created_at).toLocaleTimeString("es-CO")}</td><td>{e.event.file??e.event.kind??"—"} {e.event.sheet??""}</td><td>{e.event.status??e.event.result??e.event.phase}</td><td>{e.event.rows??"—"}</td></tr>)}</tbody></table></div></section>
 </main>;
}
