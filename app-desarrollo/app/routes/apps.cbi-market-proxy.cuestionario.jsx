import prisma from "../db.server";
import { authenticate, unauthenticated } from "../shopify.server";
import { rankCandidatesWithAI } from "../services/ai-recommendations.server";
import {
  assessRecommendationQuality,
  prepareRecommendationCandidates,
} from "../services/product-recommendations.server";

async function getProductAvailability(admin, productIds) {
  if (!productIds.length) return new Map();

  const response = await admin.graphql(
    `#graphql
      query VerifyProductAvailability($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            variants(first: 250) {
              nodes {
                availableForSale
              }
            }
          }
        }
      }`,
    { variables: { ids: productIds } },
  );
  const result = await response.json();

  if (result.errors?.length || !Array.isArray(result.data?.nodes)) {
    console.error(
      "Error de Shopify al verificar disponibilidad:",
      JSON.stringify(result.errors ?? [], null, 2),
    );
    throw new Error("PRODUCT_AVAILABILITY_VERIFICATION_FAILED");
  }

  return new Map(
    result.data.nodes
      .filter(Boolean)
      .map((product) => [
        product.id,
        product.variants?.nodes?.some((variant) => variant.availableForSale) || false,
      ]),
  );
}

async function getStoreProducts(admin) {
  const products = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await admin.graphql(
      `#graphql
        query RecommendationCandidates($after: String) {
          products(
            first: 250
            after: $after
            query: "published_status:published"
          ) {
            nodes {
              id
              status
              title
              featuredImage {
                url
                altText
              }
              handle
              productType
              vendor
              tags
              onlineStoreUrl
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }`,
      { variables: { after } },
    );
    const result = await response.json();

    if (
      result.errors?.length ||
      !Array.isArray(result.data?.products?.nodes) ||
      !result.data?.products?.pageInfo
    ) {
      console.error(
        "Error de Shopify al consultar productos:",
        JSON.stringify(result.errors ?? [], null, 2),
      );
      throw new Error("SHOPIFY_PRODUCT_QUERY_FAILED");
    }

    products.push(...result.data.products.nodes);
    hasNextPage = result.data.products.pageInfo.hasNextPage;
    after = result.data.products.pageInfo.endCursor;

    if (hasNextPage && !after) {
      throw new Error("SHOPIFY_PRODUCT_CURSOR_MISSING");
    }
  }

  return products;
}

export async function loader({ request }) {
  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session?.shop) {
      return Response.json(
        { error: "No se pudo identificar la tienda." },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const requestedQuizId = url.searchParams.get("quiz_id");

    const storeSettings = await prisma.storeSettings.findUnique({
      where: { shopDomain: session.shop },
      select: { id: true },
    });

    if (!storeSettings) {
      return Response.json(
        { error: "Esta tienda todavía no tiene un cuestionario configurado." },
        { status: 404 },
      );
    }

    const quiz = await prisma.quiz.findFirst({
      where: {
        storeSettingsId: storeSettings.id,
        isActive: true,
        ...(requestedQuizId ? { id: requestedQuizId } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: {
        questions: {
          orderBy: { position: "asc" },
          include: {
            options: { orderBy: { position: "asc" } },
          },
        },
      },
    });

    if (!quiz) {
      return Response.json(
        { error: "No se encontró un cuestionario activo." },
        { status: 404 },
      );
    }

    const settings = await prisma.storeSettings.findUnique({
      where: { shopDomain: session.shop },
      select: { welcomeMessage: true },
    });

    return Response.json({
      settings: { welcomeMessage: settings?.welcomeMessage || "" },
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        questions: quiz.questions.map((question) => ({
          id: question.id,
          text: question.text,
          type: question.type,
          position: question.position,
          required: question.required,
          options: question.options.map((option) => ({
            id: option.id,
            label: option.label,
            value: option.value,
            position: option.position,
          })),
        })),
      },
    });
  } catch (error) {
    console.error("Error al consultar el cuestionario:", error);

    return Response.json(
      { error: "No fue posible cargar el cuestionario." },
      { status: 500 },
    );
  }
}

export async function action({ request }) {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: "Método no permitido." }, { status: 405 });
    }

    const { session } = await authenticate.public.appProxy(request);

    if (!session?.shop) {
      return Response.json(
        { error: "No se pudo identificar la tienda." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const quizId = body.quiz_id;
    const answers = body.answers;

    if (
      typeof quizId !== "string" ||
      !Array.isArray(answers) ||
      answers.length > 50
    ) {
      return Response.json(
        { error: "El cuestionario o las respuestas no son válidos." },
        { status: 400 },
      );
    }

    const storeSettings = await prisma.storeSettings.findUnique({
      where: { shopDomain: session.shop },
      select: {
        id: true,
        recommendationLimit: true,
        respectBudget: true,
        outOfStockBehavior: true,
        prioritizeAvailability: true,
      },
    });

    if (!storeSettings) {
      return Response.json(
        { error: "No se encontró la configuración de la tienda." },
        { status: 404 },
      );
    }

    const quiz = await prisma.quiz.findFirst({
      where: {
        id: quizId,
        storeSettingsId: storeSettings.id,
        isActive: true,
      },
      include: {
        questions: {
          include: { options: true },
        },
      },
    });

    if (!quiz) {
      return Response.json(
        { error: "El cuestionario no existe o está inactivo." },
        { status: 404 },
      );
    }

    const selectedOptions = [];

    for (const answer of answers) {
      if (typeof answer?.questionId !== "string") {
        return Response.json(
          { error: "Hay una respuesta con formato inválido." },
          { status: 400 },
        );
      }

      const question = quiz.questions.find(
        (item) => item.id === answer.questionId,
      );

      if (!question) {
        return Response.json(
          { error: "La pregunta no pertenece a este cuestionario." },
          { status: 400 },
        );
      }

      if (question.type === "TEXT") {
        const textAnswer =
          typeof answer.textAnswer === "string" ? answer.textAnswer.trim() : "";

        if (textAnswer.length > 2000) {
          return Response.json(
            { error: "La respuesta de texto supera el límite permitido." },
            { status: 400 },
          );
        }

        if (textAnswer) {
          selectedOptions.push({
            questionId: question.id,
            question: question.text,
            label: textAnswer,
            value: textAnswer,
          });
        }

        continue;
      }

      if (typeof answer.optionId !== "string") {
        return Response.json(
          { error: "Hay una respuesta con formato inválido." },
          { status: 400 },
        );
      }

      const option = question?.options.find(
        (item) => item.id === answer.optionId,
      );

      if (!option) {
        return Response.json(
          { error: "Una opción no pertenece a este cuestionario." },
          { status: 400 },
        );
      }

      selectedOptions.push({
        questionId: question.id,
        question: question.text,
        label: option.label,
        value: option.value,
      });
    }

    for (const question of quiz.questions) {
      if (
        question.required &&
        !selectedOptions.some((answer) => answer.questionId === question.id)
      ) {
        return Response.json(
          { error: "Responde todas las preguntas obligatorias." },
          { status: 400 },
        );
      }
    }

    const { admin } = await unauthenticated.admin(session.shop);

    let catalogProducts;
    try {
      catalogProducts = await getStoreProducts(admin);
    } catch (error) {
      console.error("No se pudo cargar el catálogo de Shopify:", {
        name: error?.name,
      });
      return Response.json(
        { error: "No fue posible consultar los productos." },
        { status: 502 },
      );
    }

    const activeProducts = catalogProducts.filter(
      (product) => product.status === "ACTIVE",
    );
    // No usamos onlineStoreUrl para detectar publicación: Shopify puede
    // devolverlo como null en tiendas de desarrollo protegidas por contraseña.
    const availableProducts = activeProducts;
    const {
      eligibleProducts,
      ruleCandidates,
      aiCandidatePool,
    } = prepareRecommendationCandidates(availableProducts, selectedOptions, {
      respectBudget: storeSettings.respectBudget,
    });

    const recommendationLimit = Math.min(
      3,
      Math.max(1, storeSettings.recommendationLimit || 3),
    );

    let availableProductIds;

    try {
      availableProductIds = await getProductAvailability(
        admin,
        aiCandidatePool.map((candidate) => candidate.id),
      );
    } catch (error) {
      console.error("No se pudo confirmar el inventario de los candidatos:", {
        name: error?.name,
      });
      return Response.json(
        { error: "No se pudo verificar la disponibilidad de los productos." },
        { status: 502 },
      );
    }

    const availableAiCandidates = aiCandidatePool
      .filter((candidate) => availableProductIds.get(candidate.id) === true)
      .map((candidate) => ({ ...candidate, availableForSale: true }));
    console.info("Catálogo de recomendaciones consultado:", {
      total: catalogProducts.length,
      activos: activeProducts.length,
      publicadosEnTienda: availableProducts.length,
      elegiblesPorCategoriaYDatos: eligibleProducts.length,
      candidatosEvaluados: aiCandidatePool.length,
      disponiblesParaVenta: availableAiCandidates.length,
      coincidenciasMotorV1: ruleCandidates.length,
    });
    let candidates = ruleCandidates
      .filter((candidate) => availableProductIds.get(candidate.id) === true)
      .slice(0, recommendationLimit)
      .map((candidate) => ({ ...candidate, availableForSale: true }));
    if (candidates.length === 0) {
      candidates = availableAiCandidates.slice(0, recommendationLimit);
    }

    let engine = "v1";

    try {
      const aiResult = await rankCandidatesWithAI({
        answers: selectedOptions.map((answer) => ({
          question_id: answer.questionId,
          answer: `${answer.question}: ${answer.label} ${answer.value}`.trim(),
        })),
        candidates: availableAiCandidates,
      });

      if (aiResult?.recommendations?.length > 0) {
        const verifiedProductIds = await getProductAvailability(
          admin,
          aiResult.recommendations.map(
            (recommendation) => recommendation.product_id,
          ),
        );
        const candidatesById = new Map(
          availableAiCandidates.map((candidate) => [candidate.id, candidate]),
        );

        const aiCandidates = aiResult.recommendations
          .map((recommendation) => {
            if (verifiedProductIds.get(recommendation.product_id) !== true) {
              return null;
            }

            const candidate = candidatesById.get(recommendation.product_id);

            if (!candidate) {
              return null;
            }

            return {
              ...candidate,
              score: recommendation.score,
              priority: recommendation.priority,
              reasons: [...new Set([...candidate.reasons, recommendation.reason])],
            };
          })
          .filter(Boolean)
          .slice(0, recommendationLimit);

        if (aiCandidates.length > 0) {
          candidates = aiCandidates;
          engine = "openai";
        }
      }
    } catch (error) {
      console.error("Error de IA; se conserva Motor V1:", {
        name: error?.name,
      });
    }

    if (storeSettings.outOfStockBehavior === "SHOW_LAST") {
      const selectedIds = new Set(candidates.map((candidate) => candidate.id));
      const additionalAvailable = availableAiCandidates.filter(
        (candidate) => !selectedIds.has(candidate.id),
      );
      const soldOutCandidates = aiCandidatePool
        .filter((candidate) => availableProductIds.get(candidate.id) === false)
        .map((candidate) => ({ ...candidate, availableForSale: false }));
      if (storeSettings.prioritizeAvailability) {
        candidates = [...candidates, ...additionalAvailable, ...soldOutCandidates]
          .slice(0, recommendationLimit);
      } else {
        const ruleById = new Map(ruleCandidates.map((candidate) => [candidate.id, candidate]));
        const mixed = [...candidates, ...additionalAvailable, ...soldOutCandidates]
          .map((candidate) => ({
            ...candidate,
            score: ruleById.get(candidate.id)?.score ?? candidate.score ?? 0,
          }))
          .sort((a, b) => b.score - a.score);
        candidates = mixed.slice(0, recommendationLimit);
      }
    }

    const qualityIssues = assessRecommendationQuality({
      recommendations: candidates,
      answers: selectedOptions,
      engine,
    });
    if (qualityIssues.length) {
      console.warn("RECOMMENDATION_QUALITY_REVIEW", {
        quizId: quiz.id,
        engine,
        issues: qualityIssues,
        recommendations: candidates.map((candidate) => ({
          productId: candidate.id,
          title: candidate.title,
          price: candidate.price,
          score: candidate.score,
          reasons: candidate.reasons,
        })),
      });
    }

    return Response.json({
      quizId: quiz.id,
      count: candidates.length,
      candidates,
      engine,
      message:
        engine === "openai"
          ? "Recomendaciones generadas con IA y validadas contra los candidatos."
          : candidates.length
            ? "Candidatos encontrados mediante el Motor V1."
            : availableProducts.length === 0
              ? "No hay productos activos publicados en el canal Tienda online."
              : eligibleProducts.length === 0
                ? "No hay productos de esta categoría con imagen y precio para recomendar."
                : availableAiCandidates.length === 0
                ? "Los productos publicados no tienen variantes disponibles para venta."
                : "No se pudo obtener una recomendación; revisa la configuración de la IA.",
    });
  } catch (error) {
    console.error("Error en el motor de recomendaciones:", error);

    return Response.json(
      { error: "No fue posible generar los productos candidatos." },
      { status: 500 },
    );
  }
}
