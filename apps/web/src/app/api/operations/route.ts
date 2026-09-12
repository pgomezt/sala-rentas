import {operationsStatus,enqueueOperation} from "../../../../../../packages/database/src/operations.ts";
import {InputError} from "../../../../../../packages/database/src/review.ts";
import {boundedJson,localRequest,privateHeaders,HttpError} from "../../../../../../packages/runtime/src/http-security.ts";
export const runtime="nodejs";
export async function GET(request:Request){try{localRequest(request);return Response.json(await operationsStatus(),{headers:privateHeaders});}catch(e){return failure(e);}}
export async function POST(request:Request){try{localRequest(request,true);const body=await boundedJson(request,1024);return Response.json(await enqueueOperation(body.kind,body.retry),{status:202,headers:privateHeaders});}catch(e){return failure(e);}}
function failure(e:unknown){return Response.json({error:e instanceof InputError||e instanceof HttpError?e.message:"Operación no disponible."},{status:e instanceof HttpError?e.status:e instanceof InputError?409:503,headers:privateHeaders});}
