import { test } from "node:test";
import assert from "node:assert/strict";
import { upper,dateValue,normalize } from "../packages/domain/src/normalize.ts";
test("mayúsculas conservan acentos y ceros identificadores",()=>{ assert.equal(upper("  compañía   ñ  "),"COMPAÑÍA Ñ"); assert.equal(upper("0025123"),"0025123"); });
test("fechas estrictas y sistemas Excel",()=>{ assert.equal(dateValue("2025-02-30","1900"),null); assert.equal(dateValue("2525-01-01","1900"),null); assert.equal(dateValue(45658,"1900"),"2025-01-01"); assert.equal(dateValue(60,"1900"),null); assert.equal(dateValue(44196,"1904"),"2025-01-01"); });
test("prefijo 25, cero y original se preservan",()=>{const n=normalize(["N. Tornaguia","Total Impuesto"],[{value:"25001234567"},{value:0}],"REG","1900"); assert.equal(n.record.document_number_normalized,"25001234567"); assert.equal(n.record.declared_amount,"0"); assert.equal(n.record.quantity,null); assert.equal(n.record.eligible_for_quantity,false);});
test("cantidad extrema y fórmula quedan en cuarentena",()=>{const n=normalize(["Total Cantidad"],[{value:8600052246}],"REG","1900"); assert.equal(n.record.quality_status,"quarantine"); assert.equal(n.record.eligible_for_amount,false);});
test("fórmulas no se aceptan como evidencia validada",()=>{const n=normalize(["Total Impuesto"],[{value:100,formula:"1+99"}],"REG","1900");assert.equal(n.record.quality_status,"quarantine");assert.equal(n.record.eligible_for_amount,false);});
