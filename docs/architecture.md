# Arquitectura de CBI-Market

## Flujo del cuestionario y recomendaciones

```text
Administrador de Shopify
  ├─ /app/questions: administra preguntas y opciones
  └─ /app/settings: guarda reglas por tienda en StoreSettings
          │
          ▼
Bloque CBI-Market en la tienda online
  ├─ GET /apps/cbi-market/cuestionario: cuestionario + mensaje inicial
  └─ POST /apps/cbi-market/cuestionario: respuestas y recomendaciones
          │
          ▼
Backend de la app
  ├─ valida cuestionario, preguntas y opciones
  ├─ consulta productos activos publicados en Shopify Admin GraphQL
  ├─ aplica categoría, segmento de presupuesto y disponibilidad
  ├─ opcionalmente ordena candidatos con IA y verifica sus IDs
  └─ responde hasta el número configurado de productos
          │
          ▼
Bloque de tienda muestra imagen, nombre, precio, explicación y enlace
```

## Configuración del recomendador

La página `/app/settings` guarda en `StoreSettings` los siguientes valores por tienda:

- `recommendationLimit`: cantidad máxima de resultados, de 1 a 3.
- `welcomeMessage`: texto que acompaña al título del bloque antes del cuestionario.
- `outOfStockBehavior`: `EXCLUDE` (predeterminado) excluye productos agotados; `SHOW_LAST` permite agregarlos al final cuando falten resultados disponibles.
- `respectBudget`: intenta limitar candidatos al segmento económico, intermedio o premium según los precios del catálogo. Los segmentos son relativos a la categoría consultada; si el catálogo no tiene suficientes precios o no hay coincidencias, conserva candidatos para evitar una lista vacía.
- `prioritizeAvailability`: cuando se muestran agotados, los deja después de los productos disponibles.

No hay un editor libre de prompts en esta versión. La IA sólo recibe respuestas validadas y candidatos del catálogo, y sus IDs se verifican antes de devolver los productos. Si la llamada de IA falla, el endpoint conserva el Motor V1.

## Lectura y validación del catálogo

El endpoint de app proxy consulta productos activos publicados usando Shopify Admin GraphQL y pagina los resultados. Para cada candidato obtiene ID, título, tipo, proveedor, etiquetas, imagen, precio y handle. Antes de responder comprueba disponibilidad de variantes. Productos agotados se excluyen por defecto.

Las respuestas entrantes se validan contra el cuestionario activo y las opciones guardadas. El backend no confía en IDs de productos enviados por el navegador: sólo considera IDs obtenidos desde Shopify y vuelve a verificar los recomendados por IA.

## Persistencia

Prisma usa SQLite durante desarrollo. `StoreSettings` identifica cada tienda por dominio y conserva sus reglas; `Quiz`, `Question` y `Option` guardan el cuestionario. Los cambios de esquema se registran en `app-desarrollo/prisma/migrations`.

## Seguridad y límites

- La API key de IA permanece en el backend.
- El navegador sólo consume el endpoint público de app proxy y no puede cambiar reglas ni escoger candidatos arbitrarios.
- La regla de presupuesto clasifica precios en relación con los productos elegibles; no representa un máximo monetario fijo.
- La calidad de coincidencia con nivel o estilo depende de los datos del catálogo.
- La disponibilidad se vuelve a consultar al preparar recomendaciones; puede cambiar después de la respuesta.
