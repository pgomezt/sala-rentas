export class HttpError extends Error { status: number; constructor(status:number,message:string){super(message);this.status=status;} }
export const privateHeaders={"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
let active=0,windowStart=Date.now(),requests=0;
export function requestSlot(){
  if(Date.now()-windowStart>60000){windowStart=Date.now();requests=0;}
  if(active>=4||requests>=120)throw new HttpError(429,"Demasiadas solicitudes. Intenta nuevamente en un minuto.");
  active++;requests++;let released=false;return()=>{if(!released){released=true;active--;}};
}
export function localRequest(request:Request,write=false){
  const host=request.headers.get("host")??"";
  if(!/^(127\.0\.0\.1|localhost):3000$/.test(host)) throw new HttpError(403,"Servicio exclusivamente local.");
  const origin=request.headers.get("origin");
  if(request.headers.get("sec-fetch-site")==="cross-site" || (origin && origin!==`http://${host}`) || (write && origin!==`http://${host}`)) throw new HttpError(403,"Origen no permitido.");
  if(write&&!request.headers.get("content-type")?.startsWith("application/json")) throw new HttpError(415,"Se requiere JSON.");
}
export async function boundedJson(request:Request,max=12000):Promise<Record<string,unknown>>{
  if(Number(request.headers.get("content-length"))>max)throw new HttpError(413,"Solicitud demasiado grande.");
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,"Solicitud vacía.");
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new HttpError(413,"Solicitud demasiado grande.");}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  let result:unknown;try{result=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}catch{throw new HttpError(400,"JSON no válido.");}
  if(!result||Array.isArray(result)||typeof result!=="object")throw new HttpError(400,"Objeto JSON requerido.");
  return result as Record<string,unknown>;
}
