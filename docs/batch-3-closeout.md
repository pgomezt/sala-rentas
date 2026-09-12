# Cierre del batch 3 — 2026-09-12

Estado: cierre técnico para uso exclusivamente local. Commit/push pendientes de una sesión con permisos de escritura en Git. No se inicia el batch 4, no se publica información y no se habilita acceso por LAN, túneles ni GCP.

## Entregado

- Pantalla `/loads`: descubrimiento a solicitud, procesamiento independiente, estado del worker, progreso, historial y reintentos. No hay vigilancia periódica ni conexión a Drive.
- Cola persistente en PostgreSQL, una operación activa, bloqueo de worker único, fallos registrados y recuperación de trabajos interrumpidos. Graphile Worker no es el motor activo.
- Importación del circuito web aislada en un subproceso por archivo, seguida de normalización desde PostgreSQL. Reintentos omiten contenido y cargas ya completos. El comando CLI legado `files:import` aún procesa los archivos dentro de un mismo proceso.
- Consultas y propuestas mediante POST JSON, sin filtros sensibles en URLs; respuestas de detalle con campos explícitos, errores genéricos y caché desactivada.
- Validación de host/origen local, cuerpo limitado, parámetros SQL, renderizado textual React, CSP con nonce y protección de rutas de archivo. Límite de concurrencia y frecuencia local en la API de revisión.
- Paginación corregida para alcanzar todas las páginas REG y navegación al detalle; interfaz revisada en tamaños móvil y escritorio.

## Evidencia

Verificado nuevamente durante el cierre:

- `node scripts/task.mjs check`: tipos y 25 pruebas unitarias aprobados.
- `node scripts/task.mjs build`: servidor y compilación de producción Next.js aprobados.
- `node scripts/task.mjs db:test`: 19 comprobaciones de esquema aprobadas.
- `node tests/review.integration.ts`: conciliación, filtros, paginación, detalle y revisión transaccional aprobados; sin propuestas de prueba persistentes ni publicaciones.
- `node tests/review-http.ts`, contra el servidor de producción local: validación, SQLi, origen externo y límites de cuerpo aprobados.
- `node tests/operations.integration.ts`: cola única, fallo persistente, reintento, idempotencia y recuperación aprobados. Cada ejecución deja cuatro operaciones diagnósticas en el historial; sus fallos deliberados no son cargas de negocio fallidas.
- Revisión textual de código: sin usos de `dangerouslySetInnerHTML`, `eval`, localStorage ni sessionStorage en las áreas examinadas. Los `SELECT *` restantes detectados corresponden a funciones/vistas de migraciones, no al contrato HTTP de detalle. Esto no es un escáner completo de secretos ni una certificación de seguridad.

Evidencia obtenida durante la implementación, no repetida en este cierre:

- Verificación del lector contra 374.559 filas originales, 24 hojas: igualdad de encabezados/celdas y números de fila; aproximadamente 133 segundos y máximo RSS observado de 3.475 MiB.
- Captura completa LEG de prueba con rollback: 123.607 filas, 12 hojas, aproximadamente 43 segundos; conteo persistente sin cambios, copia temporal eliminada.
- Revisión visual responsive de cargas y tablero. No sustituye pruebas automatizadas completas de navegador.
- Auditoría npm offline sin vulnerabilidades reportadas en su información disponible. No equivale a consultar avisos de seguridad actuales.

## Operación local

En terminales separadas, desde la raíz:

```powershell
node scripts/task.mjs start:web
node scripts/task.mjs start:worker
```

Compilar previamente con `node scripts/task.mjs build` tras cambiar código. Usar `dev:web` y `dev:worker` para desarrollo, sin arrancar simultáneamente dos webs en el puerto 3000. Abrir http://127.0.0.1:3000/loads y solicitar búsqueda o procesamiento. No se aceptan rutas ni comandos arbitrarios desde la API.

`worker:check` solo comprueba configuración. `worker:once` atiende una iteración. `node scripts/stop-worker.ts` es una herramienta de mantenimiento: rechaza detener si hay operaciones activas y solo termina la conexión del worker identificado por su bloqueo en esta base. Las pruebas de operaciones requieren el worker detenido y ninguna operación activa.

## Riesgos y trabajo pendiente

1. **Bloquea exposición externa:** no hay usuarios, roles ni sesiones autenticadas. El origen/host local no es autenticación. Las propuestas usan el actor técnico `local-review`. Resolver en batch 4.
2. **Memoria XLS:** el lector materializa el libro; el aislamiento libera memoria entre archivos, no reduce el pico de un archivo. El subproceso permite hasta 4 GiB de heap, más memoria nativa. Evaluar lector alternativo o conversión controlada antes de mayores volúmenes/despliegue.
3. **Auditoría pendiente:** faltan análisis actualizados de dependencias, escaneo dedicado de secretos y pruebas dinámicas completas, incluido XSS almacenado. No se afirma ausencia de vulnerabilidades.
4. **Endurecimiento posterior:** rol local propietario de la base; separar privilegios de consulta, procesamiento y migración. Los límites de frecuencia son por proceso y solo cubren revisión. CSP permite estilos inline y `unsafe-eval` únicamente en desarrollo. Revisar todo esto antes de uso compartido.
5. **Operación:** historial visual limitado a 30 trabajos/100 eventos recientes, no visor exhaustivo. Un timeout puede dejar un descendiente terminando; los bloqueos de importación/normalización evitan recuperar trabajo mientras esos procesos siguen activos. Faltan cancelación integral, observabilidad y pruebas de restauración para producción.
6. **Negocio:** unidades, alias, interpretación de ceros/importes, cruces LEG/REG y aprobación siguen pendientes. No se eliminan duplicados ni originales; se conserva el prefijo 25.

Siguiente batch: identidad, permisos, recuperación de contraseña y sesiones. Requiere definir proveedor, correo y matriz de permisos antes de completar su implementación.
