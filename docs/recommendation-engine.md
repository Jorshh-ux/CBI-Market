# Motor de recomendación V1 sin IA

## Objetivo

Reducir el catálogo de Shopify mediante reglas deterministas antes de una futura etapa de recomendación con IA. El flujo es: respuestas del cuestionario -> evaluación de productos -> lista pequeña de candidatos.

## Atributos del catálogo utilizados

1. **Título (`title`):** permite comparar las respuestas con el nombre del producto.
2. **Tipo de producto (`productType`):** ayuda a identificar la categoría del artículo.
3. **Etiquetas (`tags`):** permiten detectar características y términos relacionados con las respuestas.
4. **Proveedor (`vendor`):** aporta coincidencias textuales adicionales.
5. **Precio (`priceRangeV2.minVariantPrice.amount`):** permite comparar el precio y distinguir segmentos económicos y premium.

La consulta también obtiene el identificador, la moneda y la URL del producto para preparar los resultados que se muestran al cliente.

## Lógica general

1. El cuestionario envía el identificador del cuestionario y las opciones seleccionadas.
2. El endpoint valida el cuestionario y comprueba que las preguntas y opciones correspondan a él.
3. Los textos se normalizan para facilitar las comparaciones: se eliminan acentos, se convierten a minúsculas y se normalizan los espacios y la puntuación.
4. Se consulta un lote de hasta 50 productos de Shopify.
5. Se evalúan los productos mediante reglas de presupuesto, nivel y tipo de snowboard.
6. Cada coincidencia aporta puntos según la regla aplicada.
7. Se descartan los productos con puntuación cero y se ordenan los restantes por puntuación descendente.
8. El endpoint limita los candidatos devueltos según la configuración de la tienda, con un máximo de 5 y un valor predeterminado de 3.
9. La extensión muestra los candidatos obtenidos. Esta versión no utiliza un modelo de IA.

## Reglas de presupuesto

La regla se aplica cuando el texto de la pregunta contiene «presupuesto». Para las opciones económicas se buscan términos como «económico», «económica», «barato» o «barata». Para las opciones premium se busca el término «premium».

El motor calcula límites a partir de los precios disponibles en el lote consultado y utiliza los tercios inferior y superior para identificar los segmentos económico y premium. Una coincidencia con el segmento solicitado suma 2 puntos.

Esta clasificación es relativa al lote recuperado, no a cantidades monetarias configuradas por el administrador. Si los precios son similares o no hay suficientes precios válidos, la distinción puede resultar poco representativa.

## Reglas de nivel

La regla se aplica cuando el texto de la pregunta contiene «nivel». Se reconocen variantes de principiante, intermedio y avanzado, incluidos algunos términos equivalentes en inglés.

La respuesta suma 2 puntos cuando el motor encuentra un término asociado al nivel seleccionado en el título, tipo de producto, proveedor o etiquetas.

La coincidencia depende de los metadatos textuales disponibles. Si estos no describen el nivel de experiencia del producto, la regla no puede determinar correctamente su adecuación al usuario.

## Reglas de tipo de snowboard

La regla se aplica cuando el texto de la pregunta contiene «snowboard» o «tipo». El motor normaliza la respuesta, separa sus palabras y descarta términos genéricos o demasiado cortos.

Las palabras restantes se comparan con el título, el tipo de producto y las etiquetas. Cada palabra que coincide aporta puntos a la puntuación del producto.

Este método es una aproximación textual: puede encontrar coincidencias parciales y no garantiza que el artículo corresponda exactamente a la intención del cliente.

## Selección de candidatos

El motor devuelve únicamente productos con puntuación positiva y los ordena de mayor a menor puntuación. El número de resultados se limita mediante la configuración de la tienda: el máximo permitido por esta versión es de 5 candidatos y el valor predeterminado es de 3.

Si varios productos tienen la misma puntuación, el orden relativo no representa una evaluación semántica de su calidad o adecuación.

## Límites conocidos

- Solo se evalúa un lote de hasta 50 productos; los productos que no entren en la consulta no pueden aparecer entre los candidatos.
- Las coincidencias textuales no garantizan que un producto satisfaga la intención del cliente.
- La regla de nivel depende de que el catálogo contenga términos relacionados con la experiencia.
- La clasificación de precios depende de los valores disponibles en el lote y no usa rangos monetarios configurables.
- No se consultan metafields en esta versión.
- Si no hay coincidencias positivas, el motor puede devolver una lista vacía.
- La puntuación por reglas no comprende contexto ni preferencias implícitas como podría hacerlo un modelo de IA.
- La disponibilidad, las variantes y la adecuación comercial deben verificarse antes de presentar el resultado como recomendación definitiva.

## Criterio de aceptación

La entrega se considera verificada cuando completar el cuestionario provoca una petición al endpoint, este devuelve candidatos correspondientes a productos reales de Shopify y la extensión muestra los resultados o un mensaje de lista vacía o error.

Las validaciones de código y documentación complementan la prueba funcional, pero no la sustituyen.
