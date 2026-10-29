# CBI-Market

CBI-Market es una aplicación para Shopify orientada a mejorar la recomendación de productos mediante un cuestionario de preferencias y un motor de selección que considera las respuestas del cliente y los productos disponibles.

El proyecto combina un motor de recomendaciones determinista (Motor V1) con una integración opcional de inteligencia artificial. La IA se ejecuta desde el backend y dispone de un mecanismo alternativo cuando el servicio no está disponible.

## Tecnologías

- React Router y React.
- Shopify App React Router y Shopify CLI.
- Node.js y npm.
- Prisma ORM con SQLite en la configuración actual.
- OpenAI API como integración opcional del backend.
- Pruebas automatizadas con Node.js Test Runner.

## Requisitos previos

- Node.js y npm en versiones compatibles con el proyecto.
- Una cuenta de Shopify con acceso a una tienda de desarrollo.
- Shopify CLI.
- Las credenciales de la aplicación Shopify.
- Una clave de OpenAI únicamente si se desea probar la integración de IA.

Consulta [docs/setup.md](docs/setup.md) para obtener las instrucciones detalladas de configuración.

## Instalación y configuración

Desde la carpeta de la aplicación:

```powershell
cd C:\Users\Jorge\CBI-Market\app-desarrollo
npm install
```

Si todavía no existe el archivo `.env`, créalo a partir del ejemplo:

```powershell
Copy-Item .env.example .env
```

Configura las variables requeridas en `.env` con los valores correspondientes a tu aplicación:

| Variable | Uso |
|---|---|
| `SHOPIFY_API_KEY` | Identificador de la aplicación Shopify. |
| `SHOPIFY_API_SECRET` | Secreto de la aplicación Shopify. |
| `SHOPIFY_APP_URL` | URL pública o de desarrollo de la aplicación. |
| `SCOPES` | Permisos solicitados por la aplicación. |
| `OPENAI_API_KEY` | Clave opcional para la integración de IA. |
| `OPENAI_MODEL` | Modelo opcional configurable para la integración de IA. |

No publiques `.env`, claves API, tokens ni secretos en Git. El archivo `.env.example` debe contener únicamente nombres de variables y valores de ejemplo no sensibles.

## Preparación de la base de datos

Ejecuta los comandos definidos por el proyecto:

```powershell
npm run setup
```

Este comando genera el cliente de Prisma y aplica las migraciones configuradas. La base de datos local debe mantenerse fuera del repositorio cuando así lo establezca `.gitignore`.

## Desarrollo local

Inicia la aplicación mediante Shopify CLI:

```powershell
npm run dev
```

Sigue las instrucciones de la CLI para iniciar la sesión, seleccionar la tienda de desarrollo e instalar o abrir la aplicación. Utiliza la URL que proporcione Shopify; no sustituyas las direcciones configuradas por valores inventados.

## Funcionalidades principales

- Cuestionario de preferencias del cliente.
- Evaluación y selección de productos candidatos.
- Motor de recomendaciones determinista como alternativa a la IA.
- Validación de identificadores de productos antes de utilizarlos.
- Manejo controlado de respuestas incompletas y errores.
- Proxy de aplicación bajo `/apps/cbi-market/cuestionario`.
- Configuración y pruebas del sistema de recomendaciones.

La disponibilidad y el comportamiento final dependen de la configuración de la tienda y de los datos reales de sus productos.

## Comandos de validación

Ejecuta desde `app-desarrollo`:

```powershell
npm run lint
npm run typecheck
npm run test:recommendations
npm run build
```

Para iniciar el entorno de desarrollo:

```powershell
npm run dev
```

No consideres una validación exitosa hasta comprobar que el comando termina sin errores.

## Documentación

- [Configuración e instalación](docs/setup.md)
- [Pruebas y validación](docs/testing.md)
- [Plan de estabilización](docs/roadmap.md)
- [Arquitectura](docs/architecture.md)

## Seguridad y mantenimiento

- Mantén las credenciales exclusivamente en variables de entorno.
- No envíes la clave de OpenAI al navegador.
- Valida las entradas recibidas por las rutas y el proxy.
- Verifica que los productos recomendados correspondan a candidatos reales.
- Ejecuta las validaciones automatizadas después de modificar el código.
- Prueba los flujos de instalación, desinstalación y webhooks en una tienda de desarrollo.
- Revisa el diff antes de cada commit y añade únicamente los archivos previstos.

## Estado del proyecto

Consulta `docs/roadmap.md` y `docs/testing.md` para distinguir las validaciones realizadas de las tareas pendientes. No marques una prueba como completada sin evidencia de su ejecución.
