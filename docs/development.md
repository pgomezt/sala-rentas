# Preparacion del entorno

## Estado

El primer commit del scaffold es 42cb412. Batch 3 cerrado técnicamente para uso local: tablero de revisión, worker operativo, cola persistente y escaneo a solicitud. Migraciones 0001..0005 aplicadas; 374.559 filas capturadas y normalizadas, sin publicaciones. Ver batch-3-closeout.md para evidencia y limitaciones actuales.

Esta sesion puede editar codigo, pero no escribir en .git ni descargar paquetes de npm. La autenticacion GitHub de la terminal del usuario no elimina esas restricciones.

## Instalar una vez desde la terminal habitual

Desde la raiz del proyecto, con Node.js 24:

```powershell
node scripts/setup.mjs
```

Instala Next.js/React para web, Graphile Worker para procesamiento, pg para acceso a PostgreSQL y herramientas TypeScript. Usa el npm distribuido con Node y una cache local ignorada en .npm-cache. No lee .env ni ejecuta migraciones.

La instalacion inicial ya fue ejecutada por el usuario. El instalador guarda versiones exactas y genera package-lock.json; al repetirse conserva las dependencias declaradas. Para instalaciones reproducibles posteriores, usar npm ci con el lockfile versionado.

Para revisar los comandos sin ejecutarlos:

```powershell
node scripts/setup.mjs --dry-run
```

SheetJS ya esta instalado. Los graficos y pruebas de navegador se incorporaran cuando se implemente su funcionalidad.

## Comandos (desde la raiz)

| Accion | Comando |
| --- | --- |
| Web local, con recarga | `node scripts/task.mjs dev:web` |
| Worker de operaciones, con recarga | `node scripts/task.mjs dev:worker` |
| Tipos, pruebas y configuracion del worker | `node scripts/task.mjs check` |
| Solo pruebas unitarias | `node scripts/task.mjs test` |
| Estado de migraciones | `node scripts/task.mjs db:status` |
| Aplicar migraciones pendientes | `node scripts/task.mjs db:migrate` |
| Integracion PostgreSQL con rollback | `node scripts/task.mjs db:test` |
| Detectar Excel nuevos/modificados | `node scripts/task.mjs files:scan` |
| Capturar filas originales sin publicar | `node scripts/task.mjs files:import` |
| Compilar servidor y web | `node scripts/task.mjs build` |
| Web compilada | `node scripts/task.mjs start:web` |
| Worker compilado | `node scripts/task.mjs start:worker` |

Tambien existen los alias npm run con los mismos nombres. Los comandos directos con node evitan el lanzador npm defectuoso detectado en esta sesion. Arrancar web y worker en terminales separadas y detener con Ctrl+C. No ejecutar dev y start web al mismo tiempo: ambos usan 127.0.0.1:3000.

Web: http://127.0.0.1:3000. GET /api/health devuelve 200 cuando la configuracion es valida o 503 con error generico. No consulta PostgreSQL y no afirma que el worker este activo. Es una comprobacion de configuracion, no de disponibilidad de la base.

El worker valida la configuración y atiende la cola PostgreSQL de operaciones solicitadas desde `/loads`. No se llama a Graphile Worker run(); la cola implementada usa tablas y bloqueos asesores propios. `worker:check` valida y termina sin dejar un proceso activo.

## Configuracion y seguridad

packages/runtime carga .env desde la raiz del monorepo, incluso arrancando en apps/web. Las variables de proceso prevalecen. Las rutas relativas se resuelven contra la raiz. La URL se valida para localhost y tornaguias_dev; ampliar expresamente esta politica antes de GCP. No registrar el objeto de configuracion ni importarlo desde componentes de cliente.

No se modifica .env ni se imprimen sus valores. Los errores de salud y arranque son genericos. Las pruebas usan credenciales ficticias y carpetas temporales propias. NEXT_TELEMETRY_DISABLED se activa en el lanzador local. Sin servicios expuestos fuera de loopback.

## Verificación histórica del entorno inicial

Esta sección registra el scaffold inicial; las verificaciones vigentes están en [cierre del batch 3](batch-3-closeout.md).

Pasaron la comprobacion de tipos (servidor, web y pruebas), ocho pruebas, compilacion de servidor y Next.js, arranque dev de web/worker, HTTP 200 en la pagina y /api/health. No se hicieron pruebas visuales de navegador. Ninguno de estos comandos importo datos ni aplico migraciones.

Los originales Excel estan en docs y SOURCE_DIRECTORY se ajusto a ./docs, sin modificar la contraseña. No mover ni modificar los originales.
