# Primera captura controlada

## Resultado del 11 de septiembre de 2026

| Archivo | Hojas | Filas originales | Estado |
| --- | ---: | ---: | --- |
| TG LEG 2025.xls | 12 | 123607 | review |
| TG REG 2025.xls | 12 | 250952 | review |
| Total | 24 | 374559 | Sin publicar |

Se verificaron los conteos de las 24 hojas contra raw.rows: cero diferencias. Una segunda ejecucion omitio ambos archivos por contenido ya capturado; permanecen dos cargas y 374559 filas. core.records y control.publications siguen vacias. No se eliminaron duplicados, ceros ni valores imposibles; la normalizacion pertenece a la siguiente fase.

## Comandos

```powershell
node scripts/task.mjs files:scan
node scripts/task.mjs files:import
```

scan lee la carpeta configurada y compara SHA256 con el inventario sin escribir en la base. Distingue NEW, CHANGED, KNOWN_CONTENT y SAME_CONTENT_OTHER_NAME. Solo examina un nivel; omite archivos temporales de Excel, ocultos y extensiones distintas de XLS/XLSX. No marca eliminaciones ni mantiene todavia un historial de escaneos. Los cambios de nombre con contenido conocido se reconocen, pero no se registra aun un alias persistente del nuevo nombre.

import captura la capa original; NO normaliza ni publica. Requiere SheetJS 0.20.3 y la migracion 0003. Se instala desde la distribucion oficial, ya declarada en packages/connectors/package.json y fijada por package-lock.json: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/

## Seguridad y trazabilidad

- SOURCE_DIRECTORY ahora apunta a ./docs. Los archivos fuente permanecen intactos.
- Se copia cada original a data/originals con nombre SHA256, sin sobrescribir. Se verifica el hash de la copia y que el origen no haya cambiado durante la lectura.
- Cada archivo se procesa dentro de una transaccion: todas sus filas o ninguna. Un bloqueo de sesion impide dos importaciones simultaneas mediante este comando.
- Los encabezados determinan REG/LEG, no el nombre del archivo. Se conservan posiciones, tipos, valores, formulas sin evaluarlas, formatos numericos y el sistema de fechas 1900/1904.
- raw.workbooks conserva el manifiesto de hojas y version del lector. raw.rows conserva todas las filas del rango utilizado despues del encabezado, incluidas posiciones vacias dentro del rango.
- Inserciones de 500 filas por lote. Se verifica que el total insertado coincida con lo leido antes del commit.
- Una carga completada con el mismo contenido y version de lector se omite. Esta idempotencia de carga NO elimina registros repetidos dentro del Excel.
- Cada carga queda en review, load_mode unclassified y scope_key provisional raw:<version>. Los controles de publicacion impiden publicarla asi.
- Si un archivo falla antes del commit, se revierten sus escrituras. La copia de respaldo puede permanecer para revision; los errores fallidos aun no tienen historial persistente de ejecuciones. No se borran copias de archivo automaticamente.

## Medicion inicial y limites

LEG: aproximadamente 43 segundos; RSS del proceso al terminar: 2021 MiB.
REG: aproximadamente 83.4 segundos; RSS al terminar: 3266 MiB.
Las dos capturas se ejecutaron secuencialmente en el mismo proceso: los valores RSS no son mediciones aisladas ni el pico maximo. El consumo es alto; medir/optimizar el lector y considerar procesos separados por archivo antes de cargas frecuentes o despliegue. El lanzador fija un limite de heap de 4096 MiB, no un limite total de memoria del proceso.

El lector materializa el workbook completo. El limite de entrada es 256 MiB por archivo; esto no garantiza proteccion ante archivos comprimidos maliciosos. Por ahora, usar solo archivos confiables y ejecutar fuera del servidor web. No es una API publica de subida.

Pendiente: normalizacion y reglas semanticas, revisiones humanas, politicas de periodos/solapamientos, publicacion, integracion en la web, conector Drive y auditoria de escaneos fallidos.
