import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { acceptedFile, within, listFiles, preserveOriginal } from "../packages/connectors/src/filesystem.ts";
import { classify } from "../packages/connectors/src/workbook.ts";
import { fileStatus } from "../apps/worker/src/import-files.ts";

test("filtra Excel temporal, ocultos y otros archivos", () => {
  assert.ok(acceptedFile("REG.XLS")); assert.ok(acceptedFile("REG.xlsx"));
  for(const name of ["~$REG.xls",".secret.xls","file.xls.exe","file.csv"]) assert.equal(acceptedFile(name),false);
});
test("limites de rutas no aceptan directorios vecinos ni padres", () => {
  assert.ok(within(resolve("data"),resolve("data/originals")));
  assert.equal(within(resolve("data"),resolve("data-other")),false);
  assert.equal(within(resolve("data"),resolve(".")),false);
});
test("clasifica por encabezados, no por nombre de archivo", () => {
  assert.equal(classify([" No Legalizacion ","Numero Tornaguia","F. Legalizacion"]),"LEG");
  assert.equal(classify(["N. Tornaguia","F. Expedicion","Total Impuesto"]),"REG");
  assert.throws(()=>classify(["numero","total"]));
});
test("descubre, verifica original, detecta cambios y reconoce copias renombradas", async () => {
  const root=await mkdtemp(resolve(tmpdir(),"tornaguias-files-"));
  try {
    await writeFile(resolve(root,"REG.xls"),"synthetic fixture, not an Excel");
    await writeFile(resolve(root,"~$LOCK.xls"),"ignore");
    await writeFile(resolve(root,"private.txt"),"ignore");
    const files=await listFiles(root); assert.equal(files.length,1);
    const file=files[0]!;
    const archive=await preserveOriginal(file,resolve(root,"originals"),root);
    assert.equal(await readFile(archive,"utf8"),await readFile(file.path,"utf8"));
    assert.equal(await preserveOriginal(file,resolve(root,"originals"),root),archive);
    const seen=[{external_id:file.name,sha256:file.sha256}];
    assert.equal(fileStatus(file,[]),"NEW");
    assert.equal(fileStatus(file,seen),"KNOWN_CONTENT");
    assert.equal(fileStatus({...file,name:"renamed.xls"},seen),"SAME_CONTENT_OTHER_NAME");
    await writeFile(file.path,"changed contents");
    const changed=(await listFiles(root))[0]!;
    assert.equal(fileStatus(changed,seen),"CHANGED");
    await assert.rejects(()=>preserveOriginal(changed,resolve(root,".."),root));
  } finally { await rm(root,{recursive:true}); }
});

