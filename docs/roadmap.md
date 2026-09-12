# Roadmap acordado

## 1–2. Base, captura, normalización y revisión: primera versión implementada

Originales conservados, PostgreSQL, reglas conservadoras, API y tablero local. Ver normalization-review.md. No es una aplicación endurecida para exposición en red: no hay autenticación de usuarios y el actor de revisión es técnico.

## 3. Cerrado para uso local: robustez operativa y seguridad base

Cierre técnico: 2026-09-12. Evidencia, operación y pendientes explícitos en [cierre del batch 3](batch-3-closeout.md). Versionado Git pendiente de completar desde una sesión con escritura en `.git`. El siguiente batch es el 4; no se ha iniciado.

Antes de añadir acciones de procesamiento desde el navegador, revisar el código ya generado y sus límites de confianza. Inventariar datos sensibles, rutas, respuestas, consultas, archivos, dependencias y registros de diagnóstico. No imprimir secretos durante la revisión.

- Prevención de SQL injection: parámetros para valores, listas permitidas para identificadores/ordenación y validación de entrada en servidor. Revisar también SQL dinámico existente y privilegios PostgreSQL.
- Prevención de XSS: renderizado seguro contextual; tratar celdas Excel, nombres de archivos y propuestas como entradas no confiables; no ejecutar HTML/fórmulas. CSP como defensa adicional, no sustituto del escape correcto.
- Revisar CSRF, autorización de acciones, filtración de errores, límites de cuerpo/archivo, rutas fuera de carpeta, enlaces simbólicos, agotamiento de recursos y ejecución de comandos.
- Minimización de datos: contratos explícitos de respuesta, sin SELECT * hacia clientes como contrato público; revisar código cliente generado, mapas de fuentes, logs, URLs, caché y almacenamiento del navegador. No enviar credenciales ni resultados completos en sesiones/tokens.
- Evitar datos sensibles en parámetros URL (incluidas solicitudes de API, que pueden registrarse aunque no aparezcan en la barra de navegación). Elegir búsquedas protegidas por cuerpo cuando corresponda, sin registrar el cuerpo sensible.
- Pruebas negativas XSS/SQLi, errores y acceso indebido; escaneo de secretos/dependencias/código cuando las herramientas y permisos lo permitan. No confundir pruebas funcionales previas con auditoría de seguridad.
- Optimizar lector XLS, pantalla de cargas, cola/progreso, historial persistente de fallos, reintentos idempotentes y pruebas de interfaz responsive.

Cierre: circuito local verificable desde el navegador y hallazgos de seguridad priorizados/resueltos según riesgo. Mantener escucha exclusiva en loopback. Esto no autoriza exposición externa ni equivale a autenticación.

## 4. Identidad, autorización y sesiones: antes de uso compartido

Implementar antes de análisis avanzado multiusuario y obligatoriamente antes de LAN, túneles o GCP. Elegir proveedor/biblioteca mantenidos tras comparar requisitos; no desarrollar criptografía propia. Proveedor aún no elegido.

- Usuarios: invitación/alta controlada, verificación de correo, edición de perfil, activación y desactivación. No asumir registro público abierto.
- Pantallas: acceso, cierre de sesión, perfil, cambio de contraseña, solicitud/restablecimiento de contraseña y administración de usuarios/roles.
- Recuperación: respuesta que no revele si existe una cuenta, tokens de un solo uso con caducidad, entrega por canal verificado, límites de intentos e invalidación de sesiones según la operación. Evitar filtrarlos por logs, analítica o Referer.
- Roles iniciales propuestos: administrador, operador de cargas, analista de consulta, revisor y aprobador. Confirmar matriz de permisos antes de implementar asignaciones finales.
- Permisos por acción, recurso y alcance de datos, comprobados en servidor para cada API/trabajo/exportación. Ocultar pantallas no es autorización. Denegar por defecto; pruebas de acceso entre usuarios e incremento de privilegios.
- Sesiones: identificador opaco o mecanismo seguro del proveedor; cookies HttpOnly, Secure en HTTPS y SameSite adecuado, rotación, expiración, revocación y cierre de todas las sesiones. No guardar contraseñas, conexión BD ni datos de negocio en cookies/JWT/localStorage. HttpOnly no reemplaza protección XSS/CSRF.
- Auditoría con identidad real; MFA al menos para cuentas privilegiadas; protección contra fuerza bruta y límites de intentos.

Cierre: pruebas de matriz de permisos, sesiones, recuperación y auditoría. Configurar correo/proveedor requerirá autorización o credenciales del usuario.

## 5. Análisis avanzado

Filtros empresariales, vistas configurables, indicadores y exportaciones sujetos a permisos y minimización de datos.

## 6. Reglas y publicación controlada

Homologación de unidades, alias aprobados, interpretación de ceros/importes, relación LEG/REG y aprobación trazable. Preservar originales/duplicados; no publicar automáticamente.

## 7. Drive y GCP: puerta de seguridad obligatoria

Separar cuentas de migración, worker y consulta con mínimo privilegio; secretos gestionados, TLS, base no expuesta públicamente, respaldos/restauración, auditoría y monitoreo. Validación de configuración de producción, dependencias y prueba dinámica en un entorno autorizado. No desplegar con vulnerabilidades críticas/altas abiertas en alcance sin evaluación explícita. Una auditoría no garantiza ausencia absoluta de intrusiones.

## Regla transversal

Cada batch incluye revisión de seguridad y pruebas de regresión, también sobre el código existente afectado. Mantener un registro de hallazgos, evidencia de corrección y riesgos pendientes. Usar OWASP ASVS como lista verificable adaptada al alcance, no como certificación automática.

Referencias: [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/), [SQL injection](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html), [sesiones](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [autenticación](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
