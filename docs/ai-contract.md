# AI Contract — CBI-Market

**Versión:** 1.0
**Fecha:** 19 de octubre de 2026
**Estado:** Aprobado técnicamente a nivel de diseño documental
**Alcance:** Contrato de entrada y salida del modelo de recomendaciones.

## 1. Objetivo

Definir el formato de los datos que CBI-Market enviará al modelo de IA y la respuesta que deberá recibir para seleccionar hasta tres productos candidatos.

El contrato se implementará después de su revisión técnica. No modifica el Motor V1 sin IA ni la integración actual del cuestionario.

## 2. Fuentes técnicas oficiales

- Shopify Developer Docs: [https://shopify.dev/docs](https://shopify.dev/docs)
- Shopify GraphQL Admin API: [https://shopify.dev/docs/api/admin-graphql](https://shopify.dev/docs/api/admin-graphql)
- Shopify `products` query: [https://shopify.dev/docs/api/admin-graphql/latest/queries/products](https://shopify.dev/docs/api/admin-graphql/latest/queries/products)
- Shopify `Product` object: [https://shopify.dev/docs/api/admin-graphql/latest/objects/Product](https://shopify.dev/docs/api/admin-graphql/latest/objects/Product)
- OpenAI API Quickstart: [https://developers.openai.com/api/docs/quickstart](https://developers.openai.com/api/docs/quickstart)
- OpenAI Structured Outputs: [https://developers.openai.com/api/docs/guides/structured-outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

Shopify será la fuente de los datos del catálogo. OpenAI será el proveedor del modelo encargado de seleccionar y justificar las recomendaciones.

## 3. Contrato de entrada

La entrada contiene dos elementos: las respuestas del usuario y los productos candidatos previamente seleccionados por el Motor V1.

### 3.1 Respuestas del usuario

Cada respuesta incluirá:

- `question_id`: identificador de la pregunta.
- `answer`: respuesta normalizada del usuario.

### 3.2 Productos candidatos

Cada candidato contendrá exclusivamente los campos necesarios para la selección:

- `product_id`: ID global de Shopify.
- `title`: título del producto.
- `product_type`: tipo de producto.
- `tags`: etiquetas relevantes.
- `price`: precio numérico representativo.
- `currency`: moneda del precio.
- `available_for_sale`: disponibilidad comprobada por el backend al preparar la entrada.

El campo `vendor` podrá añadirse si aporta información relevante para distinguir productos.

Los nombres anteriores pertenecen al contrato interno de CBI-Market. El backend será responsable de mapear los campos correspondientes del objeto `Product` de Shopify.

No se enviarán credenciales, datos personales innecesarios ni el objeto completo del producto.

**Estado de implementación:** la integración está conectada en el backend de la app. El servicio mapea los datos de Shopify (`id`, `title`, `productType`, `vendor`, `tags` y `priceRangeV2.minVariantPrice`) al payload interno, filtra productos disponibles y envía sólo las respuestas y candidatos al modelo. La respuesta estructurada se valida contra los IDs candidatos y la disponibilidad de los productos recomendados se vuelve a consultar antes de devolverlos a la tienda. Si falta la clave del servidor o falla la llamada, se conserva el resultado del Motor V1. Esto documenta el flujo implementado; la llamada real depende de configurar `OPENAI_API_KEY` y probarlo en la tienda de desarrollo.

La consulta actual utiliza `products(first: 50)`, por lo que el conjunto evaluado está limitado a los primeros 50 productos devueltos. La futura integración no deberá asumir que representa el catálogo completo.

## 4. Payload de entrada de ejemplo

Los identificadores y productos siguientes son ficticios y sólo ilustran el formato.

```json
{
  "contract_version": "1.0",
  "answers": [
    {
      "question_id": "nivel",
      "answer": "intermedio"
    },
    {
      "question_id": "presupuesto",
      "answer": "premium"
    },
    {
      "question_id": "tipo_snowboard",
      "answer": "snowboard premium"
    }
  ],
  "candidates": [
    {
      "product_id": "gid://shopify/Product/1001",
      "title": "Snowboard Premium A",
      "product_type": "Snowboard",
      "tags": ["premium", "intermedio"],
      "price": 6500,
      "currency": "MXN",
      "available_for_sale": true
    },
    {
      "product_id": "gid://shopify/Product/1002",
      "title": "Snowboard Clásico B",
      "product_type": "Snowboard",
      "tags": ["clasico", "principiante"],
      "price": 4200,
      "currency": "MXN",
      "available_for_sale": true
    }
  ],
  "max_recommendations": 3
}
```

El backend debe asegurar que los precios sean comparables y que `available_for_sale` represente la disponibilidad que se haya comprobado en Shopify.

## 5. Contrato de salida

El modelo devolverá un objeto JSON con estas propiedades:

- `contract_version`: versión del contrato.
- `recommendations`: arreglo de recomendaciones.

Cada elemento del arreglo contendrá:

- `product_id`: ID exacto de un producto candidato.
- `score`: puntuación de compatibilidad de 0 a 100.
- `priority`: posición de la recomendación, de 1 a 3.
- `reason`: explicación breve de la correspondencia entre las respuestas y los datos del producto.

El modelo podrá devolver cero, una, dos o tres recomendaciones.

El arreglo no podrá contener productos duplicados. Las prioridades deberán ser únicas y consecutivas, comenzando en 1.

El `score` representa compatibilidad estimada y no una probabilidad garantizada de compra.

## 6. Payload de salida de ejemplo

```json
{
  "contract_version": "1.0",
  "recommendations": [
    {
      "product_id": "gid://shopify/Product/1001",
      "score": 95,
      "priority": 1,
      "reason": "Coincide con el nivel intermedio, el presupuesto premium y el tipo de snowboard solicitado."
    }
  ]
}
```

La respuesta debe cumplir el esquema estructurado configurado para OpenAI. No se aceptará texto explicativo fuera del objeto JSON como respuesta contractual.

## 7. Esquema estructurado

La integración utilizará Structured Outputs de OpenAI con un JSON Schema en modo estricto.

El siguiente esquema define la estructura de salida, limita las recomendaciones a tres y prohíbe propiedades adicionales. Las reglas de negocio que dependen del catálogo se validarán también en el backend.

```json
{
  "type": "object",
  "properties": {
    "contract_version": {
      "type": "string",
      "enum": ["1.0"]
    },
    "recommendations": {
      "type": "array",
      "maxItems": 3,
      "items": {
        "type": "object",
        "properties": {
          "product_id": {
            "type": "string"
          },
          "score": {
            "type": "number",
            "minimum": 0,
            "maximum": 100
          },
          "priority": {
            "type": "integer",
            "enum": [1, 2, 3]
          },
          "reason": {
            "type": "string"
          }
        },
        "required": [
          "product_id",
          "score",
          "priority",
          "reason"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "contract_version",
    "recommendations"
  ],
  "additionalProperties": false
}
```

El backend validará adicionalmente que los identificadores pertenezcan a los candidatos autorizados, que no existan duplicados y que las prioridades sean consecutivas. También comprobará la disponibilidad de los productos antes de mostrarlos.

## 8. Validaciones obligatorias del backend

### 8.1 Estructura

- La respuesta debe ser JSON válido.
- Debe respetar la versión y estructura del contrato.
- Cada recomendación debe incluir todos los campos requeridos.
- `score` debe ser un número finito entre 0 y 100.
- `priority` debe ser un entero entre 1 y 3.
- `reason` y `product_id` deben ser cadenas no vacías.
- No se admitirán propiedades adicionales fuera del esquema.

### 8.2 ID existente y autorizado

Cada `product_id` debe corresponder a uno de los candidatos incluidos en la solicitud.

El backend rechazará IDs inventados o productos que no formen parte de la lista autorizada. Cuando sea necesario, verificará nuevamente que el producto siga existiendo en Shopify.

### 8.3 Disponibilidad

Antes de mostrar una recomendación, el backend volverá a comprobar la disponibilidad del producto.

La disponibilidad incluida en el payload es una comprobación inicial y no garantiza que el estado del producto permanezca igual durante toda la solicitud.

Los productos que ya no estén disponibles se excluirán de los resultados finales.

### 8.4 Duplicados y prioridades

No se permitirá más de una recomendación para el mismo `product_id`.

Las recomendaciones válidas se ordenarán por `score` descendente. La prioridad `1` corresponderá al producto con mayor puntuación. En caso de empate, el backend aplicará un criterio determinista para conservar un orden estable.

Después de descartar recomendaciones inválidas, el backend asignará prioridades consecutivas desde `1`, sin modificar los puntajes originales. Si no queda ninguna recomendación válida, devolverá una lista vacía.

### 8.5 Coherencia de la razón

La razón debe estar respaldada por las respuestas y los datos proporcionados al modelo. No podrá justificar una recomendación mediante características que no aparezcan en la información disponible.

### 8.6 Errores

El backend distinguirá los siguientes casos:

- **Respuesta válida sin recomendaciones:** se acepta una lista vacía cuando no existan candidatos adecuados.
- **Negativa del modelo:** se identifica y trata por separado; no se interpreta como una lista vacía ni como una respuesta contractual válida.
- **Respuesta incompleta o estructuralmente inválida:** se rechaza y no se muestran recomendaciones derivadas de ella.
- **Error técnico de la API o tiempo de espera agotado:** se registra de forma segura y se aplica la estrategia de respaldo definida por el backend, sin exponer credenciales ni detalles internos al cliente.

Una recomendación individual inválida podrá descartarse si las restantes siguen siendo válidas. Si ninguna supera las comprobaciones, se devolverá una lista vacía o se aplicará la estrategia de respaldo definida.

La validación del esquema no garantiza por sí sola que las razones sean verdaderas. El backend deberá contrastarlas con los datos disponibles y no presentar características no verificadas como hechos.

Nunca se mostrarán recomendaciones que no hayan superado las validaciones obligatorias.

## 9. Responsabilidades

**Motor V1 sin IA**

- Filtrar los productos candidatos.
- Preparar las respuestas normalizadas.
- Proporcionar los datos necesarios para la entrada.

**Modelo de IA**

- Comparar las respuestas con los candidatos recibidos.
- Seleccionar hasta tres productos.
- Asignar puntuación y prioridad.
- Proporcionar una razón respaldada por los datos.

**Backend de CBI-Market**

- Construir el payload.
- Aplicar el esquema estructurado de OpenAI.
- Validar IDs, disponibilidad, duplicados y límites.
- Controlar los errores antes de devolver los resultados al cliente.

## 10. Criterios de aceptación

- [ ] La entrada documenta respuestas y candidatos mínimos.
- [ ] Se incluye un payload de entrada válido.
- [ ] La salida contiene `product_id`, `score`, `priority` y `reason`.
- [ ] La salida permite como máximo tres recomendaciones.
- [ ] Se define el formato estructurado mediante JSON Schema.
- [ ] Se especifica la validación de IDs, disponibilidad y duplicados.
- [ ] Se documenta el tratamiento de errores.
- [ ] El contrato se revisa técnicamente antes de programar la integración.

## 11. Estado de aprobación

**Estado:** aprobado técnicamente a nivel de diseño documental, el 19 de octubre de 2026.

La revisión confirma que el contrato define la estructura de entrada y salida, los payloads de ejemplo, el esquema estructurado y las validaciones de negocio necesarias para la futura integración.

La aprobación está condicionada a utilizar un modelo compatible con Structured Outputs. Antes de implementar la llamada a OpenAI, deberán verificarse el modelo concreto, el formato de la petición y el mapeo real de los campos de Shopify.

Esta aprobación no significa que la integración esté implementada ni que se haya probado una llamada real a la API. El Motor V1 sin IA y el cuestionario permanecen sin cambios.

La integración podrá comenzar después de verificar los requisitos técnicos pendientes.
