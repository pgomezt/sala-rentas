import {NextResponse,type NextRequest} from "next/server";
export function proxy(request:NextRequest){
 const nonce=Buffer.from(crypto.randomUUID()).toString("base64");
 const dev=process.env.NODE_ENV==="development";
 const csp=`default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev?" 'unsafe-eval'":""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'${dev?" ws://127.0.0.1:3000 ws://localhost:3000":""}; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`;
 const headers=new Headers(request.headers);headers.set("Content-Security-Policy",csp);headers.set("x-nonce",nonce);
 const response=NextResponse.next({request:{headers}});
 response.headers.set("Content-Security-Policy",csp);response.headers.set("Referrer-Policy","no-referrer");response.headers.set("X-Content-Type-Options","nosniff");response.headers.set("X-Frame-Options","DENY");response.headers.set("Cache-Control","no-store");
 return response;
}
export const config={matcher:["/","/loads"]};
