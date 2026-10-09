//Data Model — CBI Market

## 1. Objetivo

Definir la estructura de datos del MVP de CBI-Market para almacenar la configuración de las tiendas y sus cuestionarios de recomendación de productos.

## 2. Decisiones de almacenamiento

- **Shopify:** es la fuente de verdad del catálogo de productos, variantes, precios e imágenes. Los productos se consultan mediante Shopify Admin GraphQL.
- **SQLite con Prisma:** almacena la configuración de cada tienda, los cuestionarios, las preguntas y sus opciones.
- **Session:** se conserva el modelo existente que utiliza la aplicación para gestionar las sesiones de Shopify.
- **Catálogo:** no se duplican los productos de Shopify en la base de datos local.

## 3. Entidades

### 3.1 StoreSettings

Almacena la configuración de cada tienda.

| Campo | Tipo | Descripción |
|---|---|---|
| id | String | Identificador único generado mediante `cuid()` |
| shopDomain | String | Dominio único de la tienda |
| recommendationLimit | Int | Límite de recomendaciones; valor predeterminado: 3 |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de última actualización |

### 3.2 Quiz

Representa un cuestionario configurable de una tienda.

| Campo | Tipo | Descripción |
|---|---|---|
| id | String | Identificador único generado mediante `cuid()` |
| title | String | Título del cuestionario |
| description | String opcional | Descripción del cuestionario |
| isActive | Boolean | Indica si el cuestionario está activo; predeterminado: `false` |
| storeSettingsId | String | Referencia a `StoreSettings` |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de última actualización |

### 3.3 Question

Representa una pregunta perteneciente a un cuestionario.

| Campo | Tipo | Descripción |
|---|---|---|
| id | String | Identificador único generado mediante `cuid()` |
| text | String | Texto de la pregunta |
| type | String | Tipo de pregunta; predeterminado: `SINGLE_CHOICE` |
| position | Int | Posición de la pregunta dentro del cuestionario |
| required | Boolean | Indica si la respuesta es obligatoria; predeterminado: `true` |
| quizId | String | Referencia a `Quiz` |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de última actualización |

### 3.4 Option

Representa una opción de respuesta de una pregunta.

| Campo | Tipo | Descripción |
|---|---|---|
| id | String | Identificador único generado mediante `cuid()` |
| label | String | Texto visible para el usuario |
| value | String | Valor interno de la opción |
| position | Int | Posición de la opción dentro de la pregunta |
| questionId | String | Referencia a `Question` |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de última actualización |

## 4. Relaciones entre entidades

- Una tienda (`StoreSettings`) puede tener varios cuestionarios (`Quiz`).
- Cada cuestionario pertenece a una tienda.
- Un cuestionario puede contener varias preguntas (`Question`).
- Cada pregunta pertenece a un cuestionario.
- Una pregunta puede contener varias opciones (`Option`).
- Cada opción pertenece a una pregunta.
- Las posiciones de las preguntas son únicas dentro de cada cuestionario mediante `@@unique([quizId, position])`.
- Las posiciones de las opciones son únicas dentro de cada pregunta mediante `@@unique([questionId, position])`.
- Las relaciones de `Quiz` a `Question` y de `Question` a `Option` utilizan eliminación en cascada.
- La relación de `Quiz` a `StoreSettings` también tiene configurada la eliminación en cascada.

## 5. Decisiones técnicas

- La base de datos utilizada es SQLite.
- Prisma ORM administra el esquema y las consultas de la base de datos.
- Los identificadores principales son cadenas de texto.
- Los campos `createdAt` y `updatedAt` permiten registrar la creación y modificación de los registros.
- El campo `type` de `Question` es de tipo `String`; `SINGLE_CHOICE` es el valor definido para el tipo de pregunta inicial.
- El campo `recommendationLimit` tiene un valor predeterminado de 3. La aplicación deberá validar el rango permitido por las reglas del MVP.

## 6. Datos de prueba

Se creó el script `app-desarrollo/prisma/seed.js` para insertar o actualizar datos de prueba y consultar el cuestionario con sus relaciones.

Los datos de prueba incluyen:

- **Tienda:** `demo-cbi-market.myshopify.com`.
- **Cuestionario:** `Cuestionario de prueba`.
- **Pregunta:** `¿Qué tipo de producto buscas?`.
- **Opción 1:** `Económico`, valor `budget`.
- **Opción 2:** `Equilibrado`, valor `balanced`.
- **Opción 3:** `Premium`, valor `premium`.

La ejecución de `node prisma/seed.js` devolvió el cuestionario, la configuración de la tienda, la pregunta y las tres opciones asociadas.

## 7. Migración y validación

Se ejecutaron correctamente los siguientes comandos desde `app-desarrollo`:

```powershell
npx prisma validate
npx prisma migrate dev --name add_quiz_data_model
npx prisma generate
node prisma/seed.js
```

La migración `20261009190806_add_quiz_data_model` se creó y aplicó correctamente. Prisma Client se generó sin errores y los datos de prueba pudieron recuperarse desde SQLite.

## 8. Alcance actual y siguientes pasos

Este modelo cubre la configuración de las tiendas y la estructura de los cuestionarios.

El catálogo de productos permanece en Shopify y se consulta mediante Shopify Admin GraphQL. El modelo todavía no incluye entidades para almacenar respuestas de clientes ni resultados históricos de recomendaciones; estas funcionalidades deberán evaluarse si se incorporan al alcance futuro del proyecto.
