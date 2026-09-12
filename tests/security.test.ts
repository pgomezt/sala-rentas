import {test} from "node:test";
import assert from "node:assert/strict";
import {boundedJson,localRequest,HttpError} from "../packages/runtime/src/http-security.ts";
const request=(body:string,origin="http://127.0.0.1:3000")=>new Request("http://127.0.0.1:3000/api/review",{method:"POST",headers:{host:"127.0.0.1:3000",origin,"content-type":"application/json"},body});
test("rechaza otros orígenes y host sin confiar en forwarded",()=>{assert.throws(()=>localRequest(request("{}","https://evil.example"),true),HttpError);const r=request("{}");r.headers.set("host","evil.example");r.headers.set("x-forwarded-host","127.0.0.1:3000");assert.throws(()=>localRequest(r,true),HttpError);});
test("limita cuerpo durante lectura, no después de JSON",async()=>{await assert.rejects(()=>boundedJson(request('"'+"a".repeat(200)+'"'),100),HttpError);await assert.rejects(()=>boundedJson(request("[]")),HttpError);await assert.rejects(()=>boundedJson(request("null")),HttpError);await assert.rejects(()=>boundedJson(request("{")),HttpError);});
test("entradas XSS permanecen texto, no se evalúan",async()=>{const value="<img src=x onerror=alert(1)>";assert.deepEqual(await boundedJson(request(JSON.stringify({value}))),{value});});
