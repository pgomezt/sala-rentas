# PostgreSQL local

## 1. Crear una base exclusiva

Abrir SQL Shell (psql) o ejecutar en una terminal:

```powershell
psql -X -h 127.0.0.1 -p 5432 -U postgres -d postgres -W
```

Introducir la contraseña de postgres en el prompt, nunca en el chat ni en el comando. Dentro de psql:

```sql
CREATE ROLE tornaguias_app LOGIN;
\password tornaguias_app
CREATE DATABASE tornaguias_dev OWNER tornaguias_app;
\q
```

La orden `\password` solicita dos veces una contraseña nueva y evita escribirla en el historial SQL. Ejecutar las sentencias una sola vez; si un nombre ya existe, detenerse y revisar, no borrar nada. No se necesita modificar embioexpress_sgol_local.

El rol no recibe SUPERUSER ni CREATEDB. En desarrollo es propietario de su base y puede ejecutar futuras migraciones. En producción se separarán propietario/migrador, importador y lector.

## 2. Guardar la conexión localmente

Desde la raíz del proyecto:

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
notepad .env
```

No repetir la copia si ya existe .env. Sustituir REEMPLAZAR_PASSWORD por la contraseña de tornaguias_app. Si contiene caracteres reservados, codificarlos como componente URL (por ejemplo @ como %40, : como %3A, # como %23 y % como %25). No usar codificadores web para secretos.

No escribir barras invertidas delante de @ ni de guiones bajos. No usar NEXT_PUBLIC_ para la conexión. .env está excluido de Git.

Para usar la carpeta actual de los Excel, se puede configurar:

```dotenv
SOURCE_DIRECTORY="C:/Users/paulo/OneDrive/Documentos/Proyectos/Gobernacion-Sala"
```

## 3. Comprobar acceso

```powershell
node scripts/check-db.mjs
```

La comprobación carga .env sin imprimirlo, limita la conexión a localhost y a tornaguias_dev, y ejecuta solo SELECT 1 en una transacción de lectura. No crea tablas ni carga datos. Requiere psql en PATH.

Después de guardar .env, basta con decir al agente: «Ya configuré .env; verifica la conexión». No compartir la contraseña. El proceso utiliza la credencial para conectar, pero no debe mostrarla ni registrarla.

No es necesario abrir el puerto a Internet. Si falla, comprobar que el servicio PostgreSQL esté iniciado, que escuche en 127.0.0.1:5432 y que el rol/contraseña correspondan a esta base.

