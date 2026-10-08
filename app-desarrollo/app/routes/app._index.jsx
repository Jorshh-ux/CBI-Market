import { useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
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
      }`,
  );

  const responseJson = await response.json();

  return {
    products: responseJson.data.products.nodes,
  };
};

export default function Index() {
  const { products } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.product?.id) {
      shopify.toast.show("Product created");
    }
  }, [fetcher.data?.product?.id, shopify]);

  const generateProduct = () => {
    fetcher.submit({}, { method: "POST" });
  };

  return (
    <s-page heading="Catálogo de productos">
      <s-section heading="Productos reales de Shopify">
        <s-paragraph>
          Estos productos se obtienen directamente desde Shopify mediante la
          Admin GraphQL API usando la consulta <s-text>products</s-text>.
        </s-paragraph>

        {products.length === 0 ? (
          <s-paragraph>
            No hay productos disponibles en el catálogo.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {products.map((product) => (
              <s-box
                key={product.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <s-stack direction="inline" gap="base">
                  {product.featuredImage?.url && (
                    <img
                      src={product.featuredImage.url}
                      alt={product.featuredImage.altText || product.title}
                      width="120"
                      height="120"
                      style={{
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                    />
                  )}

                  <s-stack direction="block" gap="small">
                    <s-heading>{product.title}</s-heading>

                    <s-text>
                      <strong>ID:</strong> {product.id}
                    </s-text>

                    <s-text>
                      <strong>Tipo:</strong>{" "}
                      {product.productType || "Sin tipo"}
                    </s-text>

                    <s-text>
                      <strong>Tags:</strong>{" "}
                      {product.tags.length > 0
                        ? product.tags.join(", ")
                        : "Sin tags"}
                    </s-text>

                    <s-text>
                      <strong>Precio:</strong>{" "}
                      {product.priceRangeV2?.minVariantPrice
                        ? `${product.priceRangeV2.minVariantPrice.amount} ${product.priceRangeV2.minVariantPrice.currencyCode}`
                        : "Sin precio"}
                    </s-text>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>

      <s-section slot="aside" heading="Información">
        <s-paragraph>
          <s-text>Productos consultados: </s-text>
          {products.length}
        </s-paragraph>

        <s-paragraph>
          <s-text>API: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql"
            target="_blank"
          >
            Shopify Admin GraphQL API
          </s-link>
        </s-paragraph>

        <s-paragraph>
          <s-text>Scope utilizado: </s-text>
          <s-text>read_products</s-text>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

