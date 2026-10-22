import prisma from "../db.server";
import { authenticate, unauthenticated } from "../shopify.server";
import { rankCandidatesWithAI } from "../services/ai-recommendations.server";

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPrice(product) {
  const amount = Number(product.priceRangeV2?.minVariantPrice?.amount);
  return Number.isFinite(amount) ? amount : null;
}

function scoreProducts(products, selectedOptions) {
  const prices = products
    .map(getPrice)
    .filter((price) => price !== null)
    .sort((a, b) => a - b);

  const lowLimit = prices.length
    ? prices[Math.floor((prices.length - 1) / 3)]
    : null;

  const highLimit = prices.length
    ? prices[Math.floor(((prices.length - 1) * 2) / 3)]
    : null;

  const scored = products.map((product) => {
    const fields = [
      product.title,
      product.productType,
      product.vendor,
      ...(product.tags || []),
    ].map(normalize);

    const searchable = fields.join(" ");
    let score = 0;
    const reasons = [];

    for (const answer of selectedOptions) {
      const question = normalize(answer.question);
      const combined = normalize(`${answer.label} ${answer.value}`);

      // Filtro por presupuesto
      if (question.includes("presupuesto")) {
        const price = getPrice(product);

        if (price !== null && lowLimit !== null) {
          if (
            /\b(economico|economica|barato|barata)\b/.test(combined) &&
            price <= lowLimit
          ) {
            score += 2;
            reasons.push("Precio dentro del segmento económico del catálogo");
          } else if (
            combined.includes("premium") &&
            highLimit !== null &&
            price >= highLimit
          ) {
            score += 2;
            reasons.push("Precio dentro del segmento alto del catálogo");
          }
        }

        continue;
      }

      // Filtro por nivel
      if (question.includes("nivel")) {
        const levels = {
          principiante: ["principiante", "beginner", "iniciacion"],
          intermedio: ["intermedio", "intermediate"],
          avanzado: ["avanzado", "advanced", "experto", "expert"],
        };

        const selectedLevel = Object.entries(levels).find(([level, aliases]) =>
          [level, ...aliases].some((word) => combined.includes(word)),
        )?.[0];

        if (
          selectedLevel &&
          levels[selectedLevel].some((word) => searchable.includes(word))
        ) {
          score += 2;
          reasons.push(`Coincidencia de nivel: ${selectedLevel}`);
        }

        continue;
      }

      // Filtro por tipo de snowboard
      if (question.includes("snowboard") || question.includes("tipo")) {
        const typeFields = [
          normalize(product.title),
          normalize(product.productType),
          ...(product.tags || []).map(normalize),
        ].join(" ");

        const words = [
          ...new Set(
            combined
              .split(/\s+/)
              .filter(
                (word) =>
                  word.length >= 3 && !["buscas", "snowboard"].includes(word),
              ),
          ),
        ];

        const matched = words.filter((word) => typeFields.includes(word));

        if (matched.length > 0) {
          score += matched.length;
          reasons.push(`Coincidencia de tipo: ${matched.join(", ")}`);
        }

        continue;
      }
    } // Esta llave cierra el for de selectedOptions.

    return {
      id: product.id,
      availableForSale: product.availableForSale === true,
      title: product.title,
      productType: product.productType || "",
      vendor: product.vendor || "",
      tags: product.tags || [],
      price: product.priceRangeV2?.minVariantPrice?.amount ?? null,
      currencyCode: product.priceRangeV2?.minVariantPrice?.currencyCode ?? null,
      url: product.onlineStoreUrl || null,
      score,
      reasons: [...new Set(reasons)],
    };
  });

  return scored
    .filter((product) => product.score > 0)
    .sort((a, b) => b.score - a.score);
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

    return Response.json({
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
      answers.length === 0 ||
      answers.length > 50
    ) {
      return Response.json(
        { error: "El cuestionario o las respuestas no son válidos." },
        { status: 400 },
      );
    }

    const storeSettings = await prisma.storeSettings.findUnique({
      where: { shopDomain: session.shop },
      select: { id: true, recommendationLimit: true },
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
      if (
        typeof answer?.questionId !== "string" ||
        typeof answer?.optionId !== "string"
      ) {
        return Response.json(
          { error: "Hay una respuesta con formato inválido." },
          { status: 400 },
        );
      }

      const question = quiz.questions.find(
        (item) => item.id === answer.questionId,
      );

      const option = question?.options.find(
        (item) => item.id === answer.optionId,
      );

      if (!question || !option) {
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
        !answers.some((answer) => answer.questionId === question.id)
      ) {
        return Response.json(
          { error: "Responde todas las preguntas obligatorias." },
          { status: 400 },
        );
      }
    }

    const { admin } = await unauthenticated.admin(session.shop);

    const response = await admin.graphql(
      `#graphql
        query RecommendationCandidates {
          products(first: 50) {
            nodes {
              id
              availableForSale
              title
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
          }
        }`,
    );

    const result = await response.json();

    if (result.errors?.length || !result.data?.products?.nodes) {
      console.error(
        "Error de Shopify al consultar productos:",
        JSON.stringify(result.errors ?? [], null, 2),
      );

      return Response.json(
        { error: "No fue posible consultar los productos." },
        { status: 502 },
      );
    }

    const availableProducts = result.data.products.nodes.filter(
      (product) => product.availableForSale === true,
    );

    let candidates = scoreProducts(availableProducts, selectedOptions).slice(
      0,
      Math.min(5, Math.max(1, storeSettings.recommendationLimit || 3)),
    );

    let engine = "v1";

    try {
      const aiResult = await rankCandidatesWithAI({
        answers: selectedOptions.map((answer) => ({
          question_id: answer.questionId,
          answer: `${answer.question}: ${answer.label} ${answer.value}`.trim(),
        })),
        candidates,
      });

      if (aiResult?.recommendations?.length > 0) {
        const candidatesById = new Map(
          candidates.map((candidate) => [candidate.id, candidate]),
        );

        const aiCandidates = aiResult.recommendations
          .map((recommendation) => {
            const candidate = candidatesById.get(recommendation.product_id);

            if (!candidate) {
              return null;
            }

            return {
              ...candidate,
              score: recommendation.score,
              priority: recommendation.priority,
              reasons: [recommendation.reason],
            };
          })
          .filter(Boolean);

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
            : "No se encontraron coincidencias suficientes en los primeros 50 productos del catálogo.",
    });
  } catch (error) {
    console.error("Error en el motor de recomendaciones:", error);

    return Response.json(
      { error: "No fue posible generar los productos candidatos." },
      { status: 500 },
    );
  }
}
