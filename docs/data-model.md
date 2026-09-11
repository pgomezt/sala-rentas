# Modelo inicial de datos

Se aplicaron 0001_ingestion.sql, 0002_normalized_quality.sql y 0003_workbook_metadata.sql a tornaguias_dev. Son 15 tablas (incluido el historial de migraciones), cuatro vistas y funciones de integridad. La primera captura cargo 374559 filas originales en raw.rows; core.records sigue vacia y no hay publicaciones. Ver ingestion.md.

## Areas

| Area | Tablas o vistas | Responsabilidad |
| --- | --- | --- |
| migration_meta | schema_migrations | SQL aplicado, SHA256, fecha y usuario |
| control | data_sources, source_files, file_versions | Ubicacion, identidad del archivo y versiones por contenido |
| control | rule_sets, load_runs | Reglas versionadas, ejecucion, alcance, periodo y clave de reintento |
| control | publications, publication_events | Version activa por conjunto y registro de cambios de publicacion |
| raw | rows | Celdas y encabezados ordenados, hoja y fila del original |
| raw | workbooks | Version del lector, sistema de fechas y manifiesto de hojas |
| core | records, companies, company_aliases | Datos normalizados y equivalencias aprobadas |
| quality | issues, review_events | Incidencias y decisiones auditables |
| analytics | published_records, expeditions, legalizations, load_summary | Vistas de consulta; REG y LEG permanecen diferenciados |

## Identidad y conservacion

El identificador interno es UUID, independiente de Columna1 y del numero comercial. El numero original y normalizado son texto; se mantienen separados el departamento emisor, consecutivo y version de la regla de interpretacion. No se elimina ni se interpreta automaticamente el prefijo 25.

No existe restriccion unica sobre el numero de tornaguia. Dos filas de origen con numeros iguales se conservan. Las restricciones unicas evitan repetir la misma fila (version de archivo, hoja y fila) o la misma transformacion (carga y fila original), no deduplican hechos de negocio. Las claves externas impiden mezclar filas de otro archivo o de otro tipo de conjunto.

Las filas originales no admiten UPDATE, DELETE ni TRUNCATE mediante operaciones normales. Las versiones y reglas tampoco admiten UPDATE/DELETE. No hay eliminaciones en cascada. Estos controles no sustituyen respaldos ni separacion de roles: el propietario de desarrollo puede alterar el esquema.

## Calidad y medidas

Los importes usan numeric(24,2), las cantidades numeric(24,6), las fechas de negocio date y las marcas de auditoria timestamptz. Los valores originales invalidos permanecen en raw; el pipeline debe dejar nulo el campo normalizado y registrar la incidencia. El intervalo representable inicial de document_year es 1900..2100; no autoriza corregir automaticamente anios ni declara validos todos los incluidos.

Los tres indicadores de elegibilidad se inicializan en false. Ceros son admisibles. Una cantidad solo es elegible si tiene unidad informada y valor no negativo; no se habilitan indicadores en registros pendientes o en cuarentena. La validacion semantica de fechas, unidades y valores extremos corresponde a las reglas del pipeline, todavia pendientes.

load_summary agrupa por carga, unidad y moneda, muestra incluidos/excluidos y conserva NULL cuando no hay valores sumables. No sumar sus filas entre versiones superpuestas. declared_amount es un importe declarado, no recaudo verificado.

## Publicacion

Cada (dataset_kind, scope_key) apunta a una sola carga lista, finalizada y de tipo snapshot con periodo informado. Cambiar el puntero dentro de una transaccion sustituye la version visible sin borrar la anterior. Las cargas listas y sus registros quedan congelados; corregir requiere otra carga. El historial de publicaciones conserva anterior, nueva, actor y fecha.

scope_key debe representar un conjunto revisado y no superpuesto; aun NO hay deteccion automatica de solapamientos entre claves diferentes. La futura aplicacion debe validar esa condicion antes de publicar. Se registra load_mode incremental, pero su publicacion se rechaza hasta implementar una politica de consolidacion. No se infieren periodos a partir del nombre del archivo.

## Migraciones y pruebas

Desde la raiz:

```powershell
node scripts/task.mjs db:status
node scripts/task.mjs db:migrate
node scripts/task.mjs db:test
```

status solo lee. migrate verifica destino local, historial y checksums; usa bloqueo transaccional para evitar concurrencia, aplica todas las pendientes en una transaccion y revierte todo ante error. Repetirlo no vuelve a ejecutar DDL. No editar SQL aplicado: crear una nueva migracion numerada. No hay comando down automatico.

db:test inserta datos ficticios dentro de una transaccion y siempre ejecuta ROLLBACK. No crea otra base, no lee Excel ni deja filas de prueba. Las 19 comprobaciones cubren procedencia, repetidos, ceros, exclusion por indicador, originales inmutables, publicacion incompleta, sustitucion de version y conservacion del historial. Las pruebas unitarias del planificador cubren reejecucion, cambios de checksum, historial desconocido y orden.

Pendiente: lectura de XLS, reglas reales, cruces LEG/REG, deteccion de solapamientos, flujo de revision, permisos separados y respaldos operativos.
