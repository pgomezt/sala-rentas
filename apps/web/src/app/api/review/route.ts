import { InputError,reviewData,recordDetail,proposeReview } from "../../../../../../packages/database/src/review.ts";
import {boundedJson,localRequest,privateHeaders,HttpError,requestSlot} from "../../../../../../packages/runtime/src/http-security.ts";
export const runtime="nodejs";
export async function GET(){return Response.json({error:"Usa una consulta JSON; los filtros no se aceptan en la URL."},{status:405,headers:privateHeaders});}
export async function POST(request:Request){
  let release:(()=>void)|undefined;
  try{
    localRequest(request,true);if(new URL(request.url).search)throw new HttpError(400,"No se permiten parámetros URL.");
    release=requestSlot();
    const body=await boundedJson(request);
    let result:unknown;
    if(body.action==="search"){
      const filters=body.filters??{};if(typeof filters!=="object"||Array.isArray(filters)||!filters)throw new InputError("Filtros no válidos.");
      const params=new URLSearchParams();for(const [k,v] of Object.entries(filters)){if(!["run","page","status","type","origin","destination","from","to","q","rule"].includes(k)||typeof v!=="string"||v.length>250)throw new InputError("Filtro no válido.");params.set(k,v);}
      result=await reviewData(params);
    }else if(body.action==="detail"&&typeof body.record==="string")result=await recordDetail(body.record);
    else if(body.action==="propose")result=await proposeReview(body);
    else throw new InputError("Acción no válida.");
    return Response.json(result,{status:result?body.action==="propose"?201:200:404,headers:privateHeaders});
  }catch(e){return Response.json({error:e instanceof InputError||e instanceof HttpError?e.message:"Operación no disponible."},{status:e instanceof HttpError?e.status:e instanceof InputError?400:503,headers:privateHeaders});}finally{release?.();}
}
