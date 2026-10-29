# Configuración local de CBI-Market

## 1. Requisitos

- Node.js y npm instalados.
- Shopify CLI instalado y autenticado.
- Acceso a una app y tienda de desarrollo de Shopify.
- Permisos para instalar la app y consultar productos.
- OpenAI API key solo si se quiere habilitar el proveedor de IA.

Consulta las versiones de tu entorno con:

```powershell
node --version
npm --version
shopify version
```

## 2. Instalar dependencias

Desde la carpeta `app-desarrollo`:

```powershell
npm install
```

## 3. Variables de entorno

`.env.example` enumera las variables esperadas:

| Variable | Uso |
|---|---|
| `SHOPIFY_API_KEY` | Identificador de la app Shopify |
| `SHOPIFY_API_SECRET` | Secreto privado de la app Shopify |
| `SHOPIFY_APP_URL` | URL pública/externa de la aplicación cuando corresponda |
| `SCOPES` | Permisos Shopify solicitados |
| `OPENAI_API_KEY` | Opcional: habilita la integración de IA |
| `OPENAI_MODEL` | Opcional: modelo configurado para el servicio de IA |

Para desarrollo local, Shopify CLI puede proporcionar variables de configuración cuando vinculas y ejecutas la aplicación. Si necesitas un archivo `.env`, créalo localmente a partir de `.env.example` y rellénalo con credenciales de tu entorno. No pegues secretos en tickets, chats, documentación o commits.

La configuración `shopify.app.toml` contiene una URL de ejemplo (`https://example.com`) y tiene habilitada la actualización automática de URLs durante el desarrollo. Confirma la app y la tienda seleccionadas en Shopify CLI antes de probar; no interpretes esa URL de ejemplo como una URL de producción.

## 4. Base de datos

La configuración Prisma actual usa SQLite. El esquema incluye sesiones Shopify, configuración de tienda, cuestionarios, preguntas y opciones. Las migraciones disponibles en el repositorio deben aplicarse antes de ejecutar la app.

El comando de desarrollo de `shopify.web.toml` ejecuta:

```powershell
npm exec prisma generate
npm exec prisma migrate deploy
npm exec react-router dev
```

También existe el script:

```powershell
npm run setup
```

que genera Prisma Client y aplica migraciones. No elimines la base de datos ni las migraciones como método de solución sin confirmar primero si contienen datos necesarios.

## 5. Ejecutar en desarrollo

```powershell
npm run dev
```

Sigue las indicaciones de Shopify CLI para vincular la app y seleccionar la tienda de desarrollo. Usa la URL de túnel que reporte la CLI para probar el app proxy.

El app proxy está configurado bajo el prefijo `apps` y subruta `cbi-market`; la ruta de cuestionario está implementada en `app/routes/apps.cbi-market-proxy.cuestionario.jsx`. Verifica la URL final en la tienda y en la configuración activa de Shopify.

## 6. Problemas comunes

- **Migraciones o Prisma Client:** vuelve a ejecutar `npm run setup` desde `app-desarrollo` y revisa el error específico.
- **Autenticación Shopify:** confirma que Shopify CLI está autenticado y que la app/tienda seleccionadas son las correctas.
- **La URL de app no coincide:** comprueba la URL informada por Shopify CLI y la configuración activa; no uses `https://example.com` como destino real.
- **No hay recomendaciones de IA:** comprueba la configuración del servidor. Si `OPENAI_API_KEY` no está disponible, la app debe usar Motor V1.
- **No aparecen productos:** revisa que la tienda de desarrollo tenga productos y que la app tenga los permisos necesarios.

## 7. Comandos de validación

```powershell
npm run lint
npm run typecheck
npm run test:recommendations
npm run build
```
