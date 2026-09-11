# Arquitectura y decisiones iniciales

## Separación

Un monorepo, dos procesos: web/API y worker. La web consulta PostgreSQL y solicita trabajos; nunca procesa Excel durante una petición. No se despliega nada en esta fase.

Stack previsto: TypeScript, Next.js/React, Node.js, PostgreSQL, Graphile Worker, SheetJS y ECharts. Probar los XLS reales antes de confirmar el lector y medir memoria, tiempo y fidelidad de tipos.

Filesystem y Drive son fuentes de entrada intercambiables. El filesystem debe ser accesible desde el worker; en GCP una ruta de este equipo no estará disponible automáticamente.

## Flujo de datos

Revisión a solicitud, inventario de archivos, detección de contenido nuevo/modificado, conservación del original, extracción, normalización, validación y publicación atómica. Los trabajos deben ser idempotentes incluso ante reintentos.

Distinguir cargas incrementales de reemplazos de períodos. No sumar versiones ni publicar archivos solapados sin una política definida. La eliminación en origen no elimina datos publicados.

Áreas previstas en PostgreSQL: control, raw, core, quality y analytics. Aún no se crean esquemas ni tablas.

## Reglas acordadas

- Conservar originales y procedencia: archivo, versión, hoja y fila.
- Normalizar nombres a mayúsculas, espacios y Unicode; conservar valor original.
- Usar NIT y equivalencias aprobadas para identidad; no fusionar por parecido.
- Conservar identificadores como texto y el prefijo 25. Su interpretación territorial requiere confirmar el formato del emisor.
- No eliminar duplicados automáticamente. Diferenciar coincidencias parciales, colisiones y versiones.
- Ceros no son errores universales; marcar según reglas del campo.
- Fechas imposibles quedan no evaluables, nunca se inventa una corrección.
- Excluir valores inválidos por indicador, no necesariamente la fila entera.
- Filas aparentemente desplazadas requieren revisión.
- Importes con precisión decimal; no usar coma flotante para cálculos monetarios.
- Las reglas y decisiones manuales deben estar versionadas y ser auditables.

## Seguridad

Sin secretos, datos personales ni Excel en Git. Credenciales exclusivamente del servidor. Desarrollo en base exclusiva. El rol local puede ser propietario de esta base; antes del despliegue separar migraciones, importación y consulta con permisos mínimos.

