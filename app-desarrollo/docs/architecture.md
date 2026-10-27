# Arquitectura del recomendador CBI-Market

## Configuración del recomendador

La ruta administrativa `/app/settings` permite configurar controles acotados, sin un editor libre de prompts:

- Número máximo de recomendaciones: de 1 a 3.
- Mensaje inicial que ve el cliente en el cuestionario.
- Tratamiento de productos agotados: excluirlos o mostrarlos al final solo cuando falten resultados.
- Regla para respetar el segmento de presupuesto seleccionado.
- Regla para priorizar productos disponibles para la venta.

La configuración se guarda por tienda en `StoreSettings`. La migración `20261026120000_add_recommender_settings` agrega estos campos con valores predeterminados.

## Flujo de recomendaciones

1. La tienda carga el cuestionario mediante el app proxy. El backend lee el mensaje inicial configurado y devuelve las preguntas activas.
2. El cliente envía el identificador del cuestionario y sus respuestas al app proxy.
3. El backend valida las respuestas contra las preguntas y opciones del cuestionario y carga la configuración de esa tienda.
4. Shopify Admin GraphQL proporciona el catálogo. El recomendador filtra productos activos y candidatos que tengan los datos necesarios para mostrarse.
5. Las reglas internas puntúan candidatos según las respuestas y, si está habilitado, el segmento de presupuesto. La disponibilidad se comprueba con Shopify antes de recomendar.
6. La IA puede ordenar los candidatos recibidos. El backend acepta únicamente IDs del conjunto candidato y vuelve a comprobar la disponibilidad antes de devolverlos. Si la IA falla, conserva el resultado del Motor V1.
7. El límite configurado se aplica (máximo 3). Según la política de agotados, se excluyen productos sin disponibilidad o se agregan al final cuando se necesiten para completar resultados. La prioridad de disponibilidad controla si se mantienen al final o participan en la clasificación por relevancia.
8. La tienda muestra las recomendaciones con imagen, nombre, precio, explicación y enlace al producto.

## Navegación administrativa

El shell de la app define `/app` como ruta de inicio con `rel="home"`; Shopify la omite del menú y muestra las secciones **Preguntas** y **Configuración**. La página Catálogo también ofrece un enlace directo a la configuración para que sea fácil de encontrar.

## Seguridad, errores y ciclo de vida

- `app/uninstalled` valida el webhook de Shopify, elimina de forma idempotente las sesiones y la configuración de esa tienda. La relación de Prisma elimina en cascada sus cuestionarios, preguntas y opciones. Si falla la limpieza, responde `500` para permitir un reintento; los logs incluyen conteos y tipo de error, nunca tokens ni contenido del cuestionario.
- El endpoint público limita el cuerpo a 32 KB, hasta 50 respuestas, texto libre a 2.000 caracteres y verifica que preguntas/opciones pertenezcan al cuestionario activo de esa tienda. Los formularios del Admin limitan preguntas a 240 caracteres, opciones a 20 de hasta 120 caracteres y cuestionarios a 50 preguntas.
- Las llamadas a Shopify son necesarias para obtener el catálogo y confirmar inventario. Ante un fallo, la app devuelve un error temporal (`503` con `Retry-After`) y no recomienda productos cuya disponibilidad no pudo comprobar. Ante un fallo, ausencia de clave o respuesta inválida de IA, conserva el resultado del Motor V1; nunca registra respuestas ni candidatos completos.
- `OPENAI_API_KEY` se usa únicamente desde el módulo de servidor y debe guardarse como secreto del entorno de ejecución. `.env` y `.env.*` están excluidos de Git; `.env.example` contiene nombres y valores ficticios. En producción, la app requiere `SHOPIFY_API_SECRET`; las credenciales de Shopify y OpenAI no deben estar en el código ni en el navegador.
