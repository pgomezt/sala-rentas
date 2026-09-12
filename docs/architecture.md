# Arquitectura y decisiones iniciales

## Separación

Un monorepo, dos procesos: web/API y worker. La web consulta PostgreSQL y solicita trabajos; nunca procesa Excel durante una petición. No se despliega nada en esta fase.

Stack implementado: TypeScript, Next.js/React, Node.js, PostgreSQL y SheetJS. La cola actual usa tablas PostgreSQL y bloqueos asesores propios; Graphile Worker está instalado pero no se ejecuta. Los gráficos iniciales son componentes de la aplicación, sin ECharts. La fidelidad del lector se verificó contra las filas capturadas; su alto consumo de memoria permanece como limitación.

Filesystem y Drive son fuentes de entrada intercambiables. El filesystem debe ser accesible desde el worker; en GCP una ruta de este equipo no estará disponible automáticamente.

## Flujo de datos

Revisión a solicitud, inventario de archivos, detección de contenido nuevo/modificado, conservación del original, extracción, normalización, validación y publicación atómica. Los trabajos deben ser idempotentes incluso ante reintentos.

Distinguir cargas incrementales de reemplazos de períodos. No sumar versiones ni publicar archivos solapados sin una política definida. La eliminación en origen no elimina datos publicados.

Áreas implementadas en PostgreSQL: control, raw, core, quality y analytics, más migration_meta para el historial. Migraciones 0001–0005 aplicadas, captura y normalización completadas, sin publicación. Ver [modelo de datos](data-model.md), [captura](ingestion.md) y [cierre del batch 3](batch-3-closeout.md).

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

Seguridad transversal, con controles base y revisión retrospectiva en el batch 3; autenticación y autorización completas pendientes del batch 4, antes de uso compartido o despliegue. El [roadmap](roadmap.md) define alcance, pantallas, roles, recuperación de contraseña y sesiones. Los controles locales actuales no sustituyen autenticación ni una auditoría independiente de seguridad.

Sin secretos, datos personales ni Excel en Git. Credenciales exclusivamente del servidor. Desarrollo en base exclusiva. El rol local puede ser propietario de esta base; antes del despliegue separar migraciones, importación y consulta con permisos mínimos.
