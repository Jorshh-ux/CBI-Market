import { useEffect } from "react";
import { useFetcher, useLoaderData, useRouteError } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const DEFAULT_MESSAGE =
  "Responde unas preguntas para descubrir qué producto se adapta mejor a tus necesidades.";
const DEFAULT_SETTINGS = {
  recommendationLimit: 3,
  welcomeMessage: DEFAULT_MESSAGE,
  outOfStockBehavior: "EXCLUDE",
  respectBudget: true,
  prioritizeAvailability: true,
};

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  try {
    const settings = await prisma.storeSettings.findUnique({
      where: { shopDomain: session.shop },
      select: {
        recommendationLimit: true,
        welcomeMessage: true,
        outOfStockBehavior: true,
        respectBudget: true,
        prioritizeAvailability: true,
      },
    });

    return { settings: settings || DEFAULT_SETTINGS, loadError: false };
  } catch (error) {
    console.error("Recommendation settings read failed", {
      errorName: error?.name || "Error",
    });
    return { settings: DEFAULT_SETTINGS, loadError: true };
  }
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const recommendationLimit = Number(formData.get("recommendationLimit"));
  const welcomeMessage = String(formData.get("welcomeMessage") || "").trim();
  const outOfStockBehavior = String(formData.get("outOfStockBehavior") || "");

  if (
    !Number.isInteger(recommendationLimit) ||
    recommendationLimit < 1 ||
    recommendationLimit > 3
  ) {
    return { error: "El número de recomendaciones debe ser de 1 a 3." };
  }
  if (!welcomeMessage || welcomeMessage.length > 240) {
    return { error: "Escribe un mensaje inicial de hasta 240 caracteres." };
  }
  if (!["EXCLUDE", "SHOW_LAST"].includes(outOfStockBehavior)) {
    return { error: "El comportamiento para productos agotados no es válido." };
  }

  try {
    await prisma.storeSettings.upsert({
      where: { shopDomain: session.shop },
      update: {
        recommendationLimit,
        welcomeMessage,
        outOfStockBehavior,
        respectBudget: formData.get("respectBudget") === "on",
        prioritizeAvailability: formData.get("prioritizeAvailability") === "on",
      },
      create: {
        shopDomain: session.shop,
        recommendationLimit,
        welcomeMessage,
        outOfStockBehavior,
        respectBudget: formData.get("respectBudget") === "on",
        prioritizeAvailability: formData.get("prioritizeAvailability") === "on",
      },
    });
  } catch (error) {
    console.error("Recommendation settings save failed", {
      errorName: error?.name || "Error",
    });
    return {
      error:
        "No se pudo guardar la configuración. Revisa la terminal de desarrollo.",
    };
  }

  return { success: "Configuración guardada." };
}

export default function SettingsPage() {
  const { settings, loadError } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.success) shopify.toast.show(fetcher.data.success);
  }, [fetcher.data, shopify]);

  return (
    <s-page heading="Configuración de recomendaciones">
      <s-section heading="Comportamiento del recomendador">
        <s-paragraph>
          Define las reglas que usará CBI-Market. Esta versión ofrece controles
          sencillos y no incluye un editor de prompts.
        </s-paragraph>
        {loadError && (
          <s-banner tone="warning">
            No se pudieron leer los ajustes guardados. Se muestran los valores
            predeterminados; revisa la terminal de desarrollo.
          </s-banner>
        )}
        {fetcher.data?.error && (
          <s-banner tone="critical">{fetcher.data.error}</s-banner>
        )}
        {fetcher.data?.success && (
          <s-banner tone="success">{fetcher.data.success}</s-banner>
        )}
        <fetcher.Form method="post">
          <s-stack direction="block" gap="base">
            <s-select
              name="recommendationLimit"
              label="Número máximo de recomendaciones"
              value={String(settings.recommendationLimit)}
            >
              <s-option value="1">1 producto</s-option>
              <s-option value="2">2 productos</s-option>
              <s-option value="3">3 productos</s-option>
            </s-select>
            <s-text-area
              name="welcomeMessage"
              label="Mensaje inicial del cuestionario"
              value={settings.welcomeMessage || DEFAULT_MESSAGE}
              maxlength="240"
              required
            />
            <s-select
              name="outOfStockBehavior"
              label="Productos agotados"
              value={settings.outOfStockBehavior}
            >
              <s-option value="EXCLUDE">Excluir productos agotados</s-option>
              <s-option value="SHOW_LAST">
                Mostrar agotados al final si hacen falta resultados
              </s-option>
            </s-select>
            <s-checkbox
              name="respectBudget"
              label="Respetar el segmento de presupuesto cuando haya productos adecuados"
              checked={settings.respectBudget}
            />
            <s-checkbox
              name="prioritizeAvailability"
              label="Priorizar productos disponibles para venta"
              checked={settings.prioritizeAvailability}
            />
            <s-paragraph>
              El presupuesto se interpreta según los precios del catálogo
              (económico, intermedio o premium), no como un monto monetario
              fijo.
            </s-paragraph>
            <button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar configuración"}
            </button>
          </s-stack>
        </fetcher.Form>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error("Recommendation settings route failed", {
    errorName: error?.name || "Error",
  });

  return (
    <s-page heading="Configuración de recomendaciones">
      <s-section heading="No se pudo cargar la configuración">
        <s-banner tone="critical">
          La app no pudo cargar estos ajustes. Revisa el error del servidor en
          la terminal de desarrollo.
        </s-banner>
        <s-link href="/app">Volver al catálogo</s-link>
      </s-section>
    </s-page>
  );
}
export const headers = (headersArgs) => boundary.headers(headersArgs);
