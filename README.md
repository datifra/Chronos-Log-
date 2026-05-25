# Contraloría de Proyectos y Tiempos - Timesheet
## Documentación Técnica y Guía de Despliegue Local

Bienvenido a la documentación técnica oficial de **Contraloría de Proyectos y Tiempos**, un sistema modular full-stack para la imputación, control y auditoría de horas laborales por proyecto y etapa, estructurado con un control de accesos jerárquico de tres niveles.

Esta guía está diseñada para que cualquier desarrollador pueda instalar, configurar, testear y ejecutar la plataforma y su base de datos relacional de soporte desde cero en su entorno local, garantizando un despliegue sin fallas.

---

## 1. Prerrequisitos del Sistema

Para levantar la aplicación correctamente, el entorno local de desarrollo debe contar con las siguientes especificaciones técnicas de software:

| Componente | Versión Recomendada | Propósito |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.x` (LTS recomendada `>= 22.x`) | Entorno de ejecución (Runtime) principal para frontend y backend. |
| **npm** | `>= 10.x` | Gestor de paquetes de dependencias de Node. |
| **PostgreSQL** | `>= 15.x` | Motor de base de datos relacional persistente. |
| **Docker & Docker Compose** | *(Opcional)* Última estable | Aislamiento y despliegue rápido del contenedor de PostgreSQL. |

---

## 2. Arquitectura y Estructura (Resumen Técnico)

### Comunicación de la Aplicación
La aplicación adopta una arquitectura full-stack híbrida y acoplada de alto rendimiento:
1. **Backend (Express + Prisma ORM):**
   - Un único punto de entrada unificado en `server.ts` que implementa tanto una API REST de alto rendimiento como un proxy de activos.
   - Utiliza **Prisma ORM** como motor de mapeo objeto-relacional (ORM) para interactuar de forma segura con PostgreSQL, con soporte nativo de tipado estricto.
   - Las conexiones concurrentes y la gestión del pool se manejan a través del controlador `pg` y el adaptador especializado `@prisma/adapter-pg`.
2. **Frontend (React 19 + Vite + Tailwind CSS v4):**
   - En desarrollo (`npm run dev`), Express monta la instancia de Vite en **Middleware Mode** (`appType: 'spa'`), sirviendo código compilado al vuelo (Hot Module Replacement virtualizado) e inyectando las rutas de la API en el mismo puerto (`3000`).
   - En producción (`npm run build`), Vite precompila el frontend a archivos estáticos optimizados en la carpeta `/dist`, y el backend en Express los expone de manera estática mediante `express.static()`.

Directivas importantes de seguridad implementadas:
- Sesiones de usuario seguras gestionadas a través de JSON Web Tokens (JWT) almacenados en cookies de sesión o cabeceras de autorización.
- Cifrado unidireccional de contraseñas mediante `bcryptjs` con factor de saturación `10`.

---

### Estructura y Funcionamiento de la Base de Datos (Modelo Físico de Datos)

El esquema relacional está diseñado bajo una estricta normalización (Tercera Forma Normal - 3NF) para evitar redundancias y asegurar la integridad de los datos. Está compuesto por 4 tablas principales persistidas en PostgreSQL y administradas mediante Prisma ORM:

#### 1. Tabla: `User` (Usuarios / Personal)
Almacena el registro maestro de colaboradores, gestores y superusuarios.
*   `id`: `Int` (Autoincremental, Llave Primaria).
*   `username`: `String` (Único) - Identificador corto para inicio de sesión seguro.
*   `passwordHash`: `String` - Hash criptográfico de la contraseña (`bcryptjs`).
*   `name`: `String` - Nombre completo o descripción legible del usuario.
*   `role`: `String` - Nivel de acceso jerárquico determinista: `"superuser"`, `"manager"` o `"user"`.
*   `email`: `String?` (Opcional) - Dirección de correo electrónico.
*   `phone`: `String?` (Opcional) - Teléfono de contacto.

#### 2. Tabla: `Project` (Proyectos)
Almacena la cabecera del proyecto con los parámetros restrictivos de horas presupuestadas y estimaciones analíticas de costo.
*   `id`: `Int` (Autoincremental, Llave Primaria).
*   `code`: `String` (Único) - Código unificado de proyecto (ej: `PEC-01`, `RAM-03`).
*   `name`: `String` - Título descriptivo del proyecto.
*   `description`: `String` - Detalle narrativo del alcance.
*   `startDate`: `String` - Fecha oficial de inicio (con formato estandarizado `YYYY-MM-DD`).
*   `budgetedHours`: `Float` - Fondo de horas total asignado al proyecto.
*   `budgetedCost`: `Float` - Presupuesto financiero asignado.

#### 3. Tabla: `Stage` (Etapas / Fases del Proyecto)
Define las fases o tareas detalladas dentro de cada proyecto individual. Tiene una relación **Muchas a Una (N:1)** con la tabla `Project`.
*   `id`: `Int` (Autoincremental, Llave Primaria).
*   `projectId`: `Int` (Llave Foránea apuntando a `Project.id`).
*   `name`: `String` - Nombre de la etapa (ej: "Diseño UX/UI", "QA & Deploy").
*   `budgetedHours`: `Float` - Margen máximo de horas presupuestadas exclusivamente para esta etapa.
*   `isOpen`: `Boolean` (Por defecto `true`) - Interruptor lógico para habilitar o deshabilitar la carga de horas de colaboradores sobre la fase.
*   *Índices Optimistas:* Cuenta con un índice explícito sobre `[projectId]` (`@@index([projectId])`) para acelerar los joins instantáneos en la cascada de búsqueda.

#### 4. Tabla: `TimeLog` (Imputaciones de Horas / Hojas de Tiempo)
Registra de forma transaccional las horas cargadas por cada colaborador en el sistema. Relaciona usuarios con proyectos y etapas concurrentes.
*   `id`: `Int` (Autoincremental, Llave Primaria).
*   `userId`: `Int` (Llave Foránea apuntando a `User.id`).
*   `projectId`: `Int` (Llave Foránea apuntando a `Project.id`).
*   `stageId`: `Int` (Llave Foránea apuntando a `Stage.id`).
*   `date`: `String` - Fecha del registro imputado (con formato `YYYY-MM-DD`).
*   `hours`: `Float` - Cantidad de horas dedicadas.
*   `description`: `String` - Comentarios de las tareas ejecutadas.

---

### Integridad Referencial y Reglas de Cascada (OnDelete Behavior)

El modelo de base de datos define comportamientos automáticos estrictos frente a la eliminación de registros para salvaguardar la precisión histórica de las auditorías:
*   **De Proyecto a Etapa (`Project` -> `Stage`)**: Configurado con `onDelete: Cascade`. Si un superusuario elimina un proyecto completo de la base de datos, todas las etapas registradas correspondientes a este proyecto se eliminarán en cascada de forma atómica en el motor relacional.
*   **De Proyecto/Etapa a Imputación (`Project`/`Stage` -> `TimeLog`)**: Configurado con `onDelete: Cascade`. Facilita la limpieza completa del historial al remover proyectos y fases sin dejar registros huérfanos.
*   **De Usuario a Imputación (`User` -> `TimeLog`)**: Configurado explícitamente con `onDelete: Restrict`. **No está permitido eliminar un usuario que tenga horas ya imputadas en el sistema.** Esto garantiza la inviolabilidad de los reportes históricos y las auditorías de horas del equipo. Para dar de baja a un colaborador sin alterar su historial de logs, sus credenciales o roles son inhabilitados en lugar de eliminarse físicamente de la base de datos.

---

### Estrategia de Indexación y Escalabilidad a Gran Escala (+100,000 Usuarios)

Cuando el volumen de la base de datos crece exponencialmente, las búsquedas secuenciales (Full Table Scan) degradan velozmente el tiempo de respuesta del servidor backend. Para mitigar esto, hemos implementado una estrategia de índices en el esquema de Prisma:

1.  **Índices sobre Llaves Foráneas Planas:**
    *   `TimeLog(userId)`, `TimeLog(projectId)` y `TimeLog(stageId)` cuentan con índices independientes de tipo B-Tree (`@@index`). Esto acelera de forma dramática las consultas filtradas utilizadas en los tableros del colaborador (ej. *"Dame todas mis horas este mes"*) y los reportes analíticos del gerente de proyecto (*"Ver desvíos del proyecto X"*).
2.  **Índices de Criterio Temporal:**
    *   `TimeLog(date)` se encuentra indexada debido a que el renderizado de calendarios y gráficos semanales/mensuales requiere realizar filtros y agrupamientos (`GROUP BY` / `WHERE date BETWEEN ...`) constantemente. Un índice B-Tree reduce la complejidad de búsqueda temporal de un orden lineal $\mathcal{O}(N)$ a un orden logarítmico $\mathcal{O}(\log N)$.
3.  **Comportamiento a 100.000 Usuarios:**
    *   Una base de datos de 100,000 colaboradores activos genera decenas de millones de filas en la tabla `TimeLog`. Al contar con índices B-Tree específicos, las lecturas asociadas a cualquier Dashboard individual de usuario o reportes de gerentes tardarán unos pocos milisegundos en resolverse en lugar de provocar bloqueos en las conexiones del pool de PostgreSQL.

---

### Estructura Clave del Repositorio

La jerarquía del repositorio se organiza de la siguiente manera:

```text
├── .env.example            # Plantilla estandarizada de variables de entorno.
├── package.json            # Scripts de ejecución, ciclo de vida de compilación y dependencias.
├── tsconfig.json           # Configuración del compilador de TypeScript.
├── vite.config.ts          # Configuración del empaquetador Vite.
├── server.ts               # Servidor Express de backend y configuración de middlewares de Vite.
├── script.ts               # Script utilitario (Smoke Test para verificación de conexión de base de datos).
├── prisma/
│   ├── schema.prisma       # Definición del esquema declarativo de la base de datos (Models & Relations).
│   └── migrations/         # Historial autogenerado de migraciones SQL (creado al correr migraciones).
├── lib/
│   ├── prisma.ts           # Inicialización inteligente del cliente Prisma (soporta Serverless y pool directo TCP).
│   └── dbService.ts        # Capa de servicio de acceso a datos, lógica de negocio y auto-seed programático.
├── src/
│   ├── main.tsx            # Punto de entrada de React enlazado al DOM elemental.
│   ├── App.tsx             # Componente raíz del cliente, enrutador general y estados globales de sesión.
│   ├── index.css           # Punto de importación exclusivo para Tailwind CSS v4 y directivas de temas.
│   ├── types.ts            # Declaración de tipos e interfaces compartidas en el frontend.
│   └── components/         # Módulos reactivos independientes y reutilizables.
│       ├── AdminUsersPanel.tsx       # Panel de administración de usuarios (Superusuario).
│       ├── ProjectManagerPanel.tsx   # Panel de configuración de proyectos y etapas (Manager / Superusuario).
│       ├── ProjectSummaryPanel.tsx   # Reportes visuales de presupuestos, descargas de PDF/Excel.
│       └── ...                       # Formularios de imputación de horas, calendario de registros y widgets.
```

---

## 3. Guía de Despliegue Paso a Paso (Quick Start)

Siga estas instrucciones en secuencia para desplegar e iniciar la aplicación de forma local:

### Paso 1: Clonar el Repositorio
Abra su terminal y descargue la base de código desde el servidor remoto Git:
```bash
git clone <URL_DEL_REPOSITORIO>
cd <NOMBRE_DEL_DIRECTORIO>
```

### Paso 2: Instalar Dependencias del Proyecto
Instale los paquetes de Node requeridos para la correcta compilación y linting:
```bash
npm install
```
*Nota: Este comando disparará automáticamente el script `postinstall` configurado en el `package.json`, el cual ejecuta `prisma generate` para generar localmente los tipos estrictos del cliente en `generated/prisma`.*

### Paso 3: Configurar Variables de Entorno
Cree su archivo de variables locales `.env` a partir de la plantilla:
```bash
cp .env.example .env
```

Abra el archivo `.env` e ingrese los valores de configuración específicos de su entorno. A continuación se describe el contenido esperado:

```env
# -----------------------------------------------------------------------------
# CONFIGURACIÓN GENERAL DE LA APP
# -----------------------------------------------------------------------------
# Puerto local en el cual correrá el servidor Express (el puerto 3000 es la norma preestablecida)
PORT=3000

# URL auto-referencial del servicio para resoluciones de API y callbacks
APP_URL="http://localhost:3000"

# Secreto criptográfico utilizado para firmar y validar los JWT firmados por el servidor
JWT_SECRET="una_cadena_secreta_altamente_robusta_y_aleatoria_de_32_bytes_minimo"

# -----------------------------------------------------------------------------
# BASE DE DATOS (CONEXIÓN POSTGRESQL CON PRISMA)
# -----------------------------------------------------------------------------
# URL de conexión directa TCP a su instancia de base de datos PostgreSQL.
# Estructura: postgresql://<usuario>:<contraseña>@<host>:<puerto>/<nombre_db>?schema=public
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/timesheet_db?schema=public"

# -----------------------------------------------------------------------------
# APIS COMPLEMENTARIAS (OPCIONAL)
# -----------------------------------------------------------------------------
# Proveedor opcional de inteligencia artificial Gemini para enriquecimiento de descripciones o sumarios
GEMINI_API_KEY="AIzaSy..."
```

---

## 4. Configuración y Puesta en Marcha de la Base de Datos

El sistema requiere una base de datos PostgreSQL activa. Tiene dos alternativas para montarla localmente:

### Opción A: Levantar Base de Datos con Docker (Recomendado)
Si cuenta con Docker en su máquina, puede crear y levantar una instancia de PostgreSQL en segundos sin necesidad de instalarla en su sistema operativo host. Ejecute en su terminal:

```bash
docker run --name pg-timesheet \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=timesheet_db \
  -p 5432:5432 \
  -d postgres:16-alpine
```

### Opción B: Base de Datos PostgreSQL Nativa Local
Si prefiere un motor de base de datos instalado nativamente en su sistema:
1. Abra su consola de PostgreSQL (`psql` o mediante un cliente como pgAdmin, DBeaver, etc.).
2. Cree la base de datos necesaria:
   ```sql
   CREATE DATABASE timesheet_db;
   ```
3. Asegúrese de que el puerto por defecto sea `5432` y de que las credenciales de conexión ingresadas en el `.env` (Usuario y Contraseña) tengan los privilegios adecuados para escribir esquemas en la base de datos de destino.

---

### Execución de Migraciones y Auto-Semillado (Auto-Seed)

Una vez que la instancia de PostgreSQL esté activa y la variable `DATABASE_URL` esté correctamente insertada en el `.env`, proceda a aplicar el esquema físico de tablas y relaciones de la siguiente manera:

#### 1. Sincronizar el Esquema Físico (Migración Inicial)
Para crear las tablas, llaves foráneas e índices estructurados en la base de datos, ejecute:
```bash
npx prisma db push
```
*Este comando analiza el archivo `prisma/schema.prisma` y mapea los modelos físicos en su motor PostgreSQL directamente, optimizando adicionalmente los índices de consulta en las tablas `TimeLog` y `Stage` para garantizar un rendimiento óptimo a gran escala.*

#### 2. Carga Inicial de Datos (Seed/Mock Data)
**El sistema cuenta con un motor de semillado automático integrado (Auto-Seeding).** 
Cuando el backend Express arranca y detecta que la base de datos recién creada está vacía (específicamente la ausencia de un usuario con nombre de usuario `"admin"`), el servicio en la capa `lib/dbService.ts` se activa de forma automática poblando por completo de manera consistente el esquema con los datos iniciales de prueba:

- **2 Cuentas Jerárquicas Clave predeterminadas:**
  - **Superusuario (Admin):** Username `admin`, Password `admin`  *(Rol: Completo, elimina proyectos y gestiona credenciales de equipo)*.
  - **Gerente de Proyectos (Manager):** Username `manager`, Password `manager` *(Rol: Crea proyectos y analiza reportes analíticos de desvíos)*.
- **48 Colaboradores de simulación:** 
  - Usernames desde `user1` hasta `user48` (Passwords genéricos `user123` para todos) con rol colaborador para imputaciones y visualización individual de métricas.
- **Proyectos de prueba parametrizados:**
  - `PEC-01`: Portal de E-commerce Multi-idioma
  - `MBC-02`: Migración de Base de Datos Cloud
  - `RAM-03`: Rediseño App Móvil iOS/Android
  - `VARIOS`: Control de Actividades varias de soporte administrativo general.
- **Fases/Etapas precargadas** para cada proyecto con sus respectivas horas de presupuesto y registros históricos de horas (TimeLogs) ya asociados para simulaciones analíticas inmediatas.

Si en algún momento desea forzar la carga inicial, simplemente inicie la aplicación y deje que el subsistema integrado de base de datos la gestione.

#### 3. Verificación Rápida de Conexión (Smoke Test)
Si desea verificar la comunicación bidireccional inmediata con su base de datos sin levantar todo el servidor, puede ejecutar el script utilitario integrado:
```bash
npx tsx script.ts
```

---

## 5. Comandos de Ejecución

Existen distintos scripts configurados en el archivo `package.json` para controlar el ciclo de vida de la aplicación en desarrollo y producción:

### Entorno de Desarrollo (Recomendado)
Levanta la API Backend en Express e inicia la instancia de desarrollo Vite en paralelo, sirviendo la aplicación de inmediato bajo un puerto unificado:
```bash
npm run dev
```
La aplicación estará disponible de forma local en la URL: **`http://localhost:3000`**

---

### Entorno de Producción
En un ambiente de producción, la compilación y el inicio se deben gestionar de manera aislada para maximizar la velocidad de respuesta y minimizar el consumo de recursos de disco:

#### 1. Compilar la Aplicación
Genera los binarios del frontend y empaqueta el backend en un único archivo CJS unificado para evitar resolución de módulos relativos lentos en Node:
```bash
npm run build
```
*Este comando genera la carpeta física `/dist` conteniendo los assets estáticos minificados del cliente React y el servidor backend bundled en `/dist/server.cjs`.*

#### 2. Arrancar Servidor de Producción
Sirve el compilado optimizado de producción:
```bash
npm start
```
El servidor de producción correrá por defecto de forma estricta en el puerto `3000`.

---

### Tareas de Mantenimiento y Calidad de Código
Para evaluar y garantizar que no existan errores estáticos en la sintaxis de TypeScript del sistema completo, puede correr en cualquier momento:
```bash
npm run lint
```

Para purgar las carpetas compiladas y restablecer un entorno limpio libre de remanentes locales:
```bash
npm run clean
```

---

## 6. Solución de Problemas Comunes (Troubleshooting)

### Error 1: `Database smoke test could not complete` o fallos en el handshake con PostgreSQL
* **Síntoma:** No se puede iniciar el servidor, o el utilitario `script.ts` falla arrojando un error de red o timeout de conexión.
* **Causa:** El string provisto en la variable `DATABASE_URL` del archivo `.env` no apunta a un puerto abierto, o las credenciales no son idénticas a las configuradas en el servicio creador.
* **Resolución:** 
  1. Revise detalladamente que el motor de PostgreSQL esté en ejecución en su puerto local (por defecto `5432`) usando el comando `docker ps` o la herramienta de gestión de red de su S.O.
  2. Compruebe la validez del string de conexión probando el acceso en su terminal con `psql -h localhost -U postgres -d timesheet_db`.

### Error 2: `Port 3000 is already in use`
* **Síntoma:** El comando `npm run dev` o `npm start` falla indicando que la dirección ya está tomada.
* **Causa:** Otro proceso está corriendo en segundo plano utilizando el puerto `3000`.
* **Resolución:**
  1. Puede liberar el puerto identificando y finalizando el PID del proceso causante:
     * **macOS / Linux:** Ejecute `lsof -i :3000` y luego `kill -9 <PID>`.
     * **Windows (PowerShell):** Ejecute `Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force`.
  2. Alternativamente, modifique temporalmente la variable `PORT=3000` en su archivo `.env` local para derivar el tráfico de desarrollo hacia un puerto alterno disponible (e.g., `PORT=3001`).

### Error 3: Prisma arroja un fallo del estilo `PrismaClientInitializationError` o error de cliente no generado
* **Síntoma:** Durante la ejecución, se disparan excepciones referidas a que el cliente de Prisma está desactualizado o que faltan definiciones de tipos.
* **Causa:** El cliente Prisma persistido no concuerda con las dependencias locales del módulo de Node o se eliminó la caché del directorio temporal.
* **Resolución:** Vuelva a forzar el motor de inicialización de Prisma ejecutando el siguiente comando:
  ```bash
  npx prisma generate
  ```
  Esto regenerará de inmediato los archivos estrictos en `generated/prisma` permitiendo que TypeScript reconozca cada modelo definido sin problemas.
