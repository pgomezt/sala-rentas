# Normalización y revisión local

## Ejecución

1. `node scripts/task.mjs db:migrate`
2. `node scripts/task.mjs data:normalize`
3. `node scripts/quality-report.ts`
4. `node tests/review.integration.ts`
5. `node scripts/task.mjs dev:web` → http://127.0.0.1:3000/

La captura se solicita con `files:scan` / `files:import`. No hay vigilancia periódica, Drive ni despliegue activado. Tampoco se ha programado una reanudación por cuota.

## Separación de responsabilidades

La compilación de producción usa `.next-production` y el servidor de desarrollo `.next`, para evitar colisiones con archivos abiertos en Windows. Usar los comandos raíz para compilar/arrancar; establecen la selección de salida automáticamente.

- Dominio: `packages/domain/src/normalize.ts`, funciones puras sin PostgreSQL ni interfaz.
- Procesamiento independiente: `apps/worker/src/normalize-rows.ts`, cursor de 500 filas; no abre los Excel.
- Persistencia y consultas: `packages/database/src/review.ts`, filtros parametrizados y transacción de lectura consistente.
- Presentación/API: Next.js. La API nunca importa archivos ni normaliza durante una petición.

## Reglas conservative-1

- Textos NFC, espacios externos/repetidos normalizados y mayúsculas; conserva acentos y Ñ. No fusiona empresas por similitud ni aprueba alias.
- Número original y número normalizado completos como texto. Conserva prefijo 25 y ceros iniciales presentes en la fuente. No asigna automáticamente código de departamento ni cruza LEG con REG. Ceros iniciales ya perdidos en una celda numérica no se inventan.
- Vacíos numéricos → null, nunca cero. Acepta números decimales inequívocos con punto; formatos ambiguos se señalan. Ceros permanecen con incidencia informativa. Negativos no participan en importes.
- Fechas Excel 1900/1904, ISO o DD/MM/YYYY estrictas. Ventana técnica provisional 2000–2030; fuera de ella se conserva el original y el campo tipado queda null. No es una restricción normativa: ampliar mediante nueva versión de reglas cuando corresponda.
- Cantidad > 1.000.000: alerta técnica y cuarentena, no afirmación de imposibilidad. Errores de celda, fórmulas y contenido especial también ponen la fila en cuarentena. No realinea columnas automáticamente.
- Cantidades no sumables hasta homologar unidades/presentaciones; todas tienen UNIT_UNCONFIRMED. Se conserva el valor individual.
- Importes admitidos técnicamente por formato/signo y ausencia de cuarentena; no validación tributaria, estadística ni prueba de recaudo. No mezclar LEG y REG.
- Orden temporal inconsistente produce advertencia; no determina incumplimiento legal ni calcula sanciones. Dias Ext permanece en normalized_fields, sin reinterpretarse como mora.
- Claves año/número repetidas: alerta en todas las filas del grupo, no deduplicación. No prueba igualdad de todas las columnas.

## Integridad y recuperación

Cada versión de archivo y reglas produce una carga nueva, separada de la captura original. Una transacción por carga escribe registros, incidencias y estado review. El conteo debe coincidir con la captura; si falla o se cancela, se revierte la carga incompleta. El reintento omite las cargas ya completas. Las nuevas reglas deben usar una versión nueva, no modificar resultados anteriores.

El bloqueo asesor impide normalizadores concurrentes. Las consultas del procesador tienen límite de 120 segundos por sentencia. La agrupación de claves usa una función ventana; evita una unión costosa en una tabla recién cargada sin estadísticas actualizadas.

La carga fallida se revierte; el circuito de operaciones del batch 3 conserva el fallo en su historial independiente. La captura Excel aún materializa cada libro y puede usar varios GiB. El aislamiento por archivo libera memoria entre importaciones, no reduce el pico de un libro. Ver batch-3-closeout.md.

## Tablero y API

`POST /api/review`, acción `search`, filtros en cuerpo JSON: carga, estado, tipo, origen, destino, desde/hasta, número completo exacto, regla y página. GET y parámetros URL se rechazan. Una carga por consulta evita sumar versiones superpuestas. Meses y principales destinos cuentan filas, incluidos registros observados; el tablero lo identifica como revisión. Las fechas de filtro son legalización LEG / expedición REG. Sin fecha válida se informa por separado y queda fuera de filtros temporales.

`POST /api/review`, acción `detail`, identificador en el cuerpo: campo tipado, descriptor original, texto normalizado, incidencias e historial. Listados: 25 filas, orden estable por UUID, página validada contra el total y límite técnico de 1.000.000. Opciones categóricas corresponden a la carga completa; no son filtros en cascada.

`POST /api/review`, acción `propose`: propuesta con issue, value y reason. Crea un evento append-only; no aplica correcciones, resuelve incidencias ni publica. Actor local técnico `local-review`, no identidad autenticada. Solo acepta JSON del mismo origen y host local. No exponer en red ni desplegar antes de incorporar autenticación, autorización y auditoría de usuarios.

## Pendientes que requieren criterio de negocio

Confirmar unidades, equivalencias empresariales, umbrales, interpretación de ceros, semántica de importes y reglas de relación LEG/REG. No hay aprobación/publicación automática. Una revisión de producción posterior debe incluir fallos persistentes, observabilidad, rendimiento del lector, accesos y fuentes externas.

## Resultado de la primera ejecución

374.559 filas conciliadas: LEG 123.607 y REG 250.952. Todas permanecen en review, cero publicaciones. Repetir la ejecución omite ambas cargas.

- LEG: 104 incidencias de fecha y 104 de vigencia; 4.781 valores numéricos ausentes; 1.858 incidencias de cero; 2 filas con clave repetida.
- REG: 1 cantidad extrema en cuarentena; 5 incidencias de formato numérico; 15 valores numéricos ausentes; 152 incidencias de cero; 2.328 filas con clave repetida (no 2.328 grupos ni duplicados exactos).
- Todas las filas tienen unidad pendiente. Una fila puede contribuir a varias incidencias.

Memoria RSS al terminar: LEG 234 MiB, REG 240 MiB. No son mediciones del pico. LEG terminó en 75 s; el reintento REG en 194 s. La primera consulta de repetidos REG fue cancelada por rendimiento y su transacción se revirtió antes del reintento optimizado.

Verificación inicial: 22 pruebas unitarias, 19 controles de esquema, conciliación de procedencia, filtros/paginación y revisión transaccional; pruebas HTTP de errores y origen externo. Ninguna propuesta de prueba persistió. Para las 25 pruebas actuales, revisión responsive y controles añadidos posteriormente, ver [cierre del batch 3](batch-3-closeout.md).
