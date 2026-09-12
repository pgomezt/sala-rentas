export async function reviewRequest(body:Record<string,unknown>,signal?:AbortSignal){
  const response=await fetch("/api/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),...(signal?{signal}:{})});
  const data=await response.json();if(!response.ok)throw new Error(data.error??"Consulta no disponible.");return data;
}
