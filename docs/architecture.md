//Arquitectura

//Flujo de lectura de productos

La aplicación utiliza la Shopify Admin GraphQL API para consultar productos reales de la tienda.

//ARQUTECTURA
Shopify Admin
     │
     │ Catálogo de productos
     ▼
App Shopify
     │
     │ authenticate.admin()
     ▼
Admin GraphQL API
     │
     │ query products(first: 10)
     ▼
Productos
     │
     ├── ID
     ├── título
     ├── tipo
     ├── tags
     ├── imagen
     └── precio
     │
     ▼
Interfaz de la aplicación

//Flujo técnico

1. El usuario abre la aplicación instalada en Shopify.
2. La ruta `app/routes/app._index.jsx` autentica la sesión mediante `authenticate.admin()`.
3. La aplicación obtiene el cliente `admin` para comunicarse con la Shopify Admin GraphQL API.
4. Se ejecuta la consulta `products(first: 10)`.
5. GraphQL devuelve los primeros 10 productos disponibles.
6. La aplicación obtiene los siguientes datos de cada producto:

   * ID
   * título
   * tipo
   * tags
   * imagen destacada
   * precio mínimo de variante
7. Los datos se entregan al componente React mediante el `loader`.
8. La interfaz muestra el catálogo real de Shopify.

//Consulta utilizada

La aplicación utiliza el scope:

```toml
[access_scopes]
scopes = "read_products"
```

//Este scope permite consultar información de productos sin solicitar permisos de escritura sobre el catálogo.

La consulta utilizada es:

```graphql
query GetProducts {
  products(first: 10) {
    nodes {
      id
      title
      productType
      tags
      featuredImage {
        url
        altText
      }
      priceRangeV2 {
        minVariantPrice {
          amount
          currencyCode
        }
      }
    }
  }
}
```

// Tecnologías involucradas

* Shopify Admin GraphQL API
* React
* React Router
* JavaScript / JSX
* Shopify App Bridge
* Shopify Polaris Web Components

//Resultado

La aplicación logra consultar y mostrar 10 productos reales de la tienda mediante GraphQL utilizando únicamente el scope `read_products`.
