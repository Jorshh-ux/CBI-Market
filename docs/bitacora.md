// Bitácora

// 6 de octubre de 2026

* Qué hice: Creé el repositorio, la carpeta `/docs` y el archivo `scope.md`.
* Qué aprendí: Entendí qué problema busca resolver el recomendador y cómo funcionará en general.
* Qué falló:  No tuve errores importantes.
* Cómo lo resolví: Revisé el plan y seguí las actividades indicadas para hoy.
* Qué queda pendiente: Crear la app de Shopify y empezar la parte técnica.

// 8 de octubre de 2026

// Qué hice: Configuré la aplicación de Shopify y ajusté los permisos para utilizar únicamente el scope read_products. Eliminé la definición de //metafield que solicitaba permisos de escritura sobre productos. Después implementé una consulta GraphQL para obtener los primeros 10 productos reales de la tienda.

//Qué aprendí: Entendí cómo una aplicación Shopify autenticada puede utilizar admin.graphql() para consultar información del catálogo mediante la Admin GraphQL API. También entendí la relación entre los scopes y los permisos que necesita la aplicación.

//Qué falló: Inicialmente la aplicación solicitaba write_products debido a una definición de metafield incluida en la plantilla. Además, al principio apareció un error 404 al abrir la aplicación.

//Cómo lo resolví: Eliminé la definición del metafield que requería merchant_read_write, dejando únicamente read_products. Después ajusté la ruta principal de la aplicación para consultar y mostrar los productos mediante GraphQL.

//Resultado: La aplicación quedó funcionando y muestra 10 productos reales de Shopify con ID, título, tipo, tags, imagen y precio.
