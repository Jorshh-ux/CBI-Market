
import OpenAI from "openai";

const CONTRACT_VERSION = "1.0";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 12000,
      maxRetries: 1,
    })
  : null;

// OPENAI IMPORTA EL SDK QUE INSTALE
//CONTRACT_VERSION IDENTIFICA LA VERSION DEL CONTRATO QUE DEFINI EN DOCS/AI-CONTRACTS.MD
//MODEL PERMITE ELIGIR EL MODELO MEDIANTE UNA VARIABLE DE ENTORNO
//openai CREA EL CLIENTE UNICAMENTE CUANDO EXITSE UNA CLAVE API EN EL ENTORNO DEL SERVIDOR 


const recommendationSchema = {
  type: "object",
  properties: {
    contract_version: {
      type: "string",
      enum: ["1.0"],
    },
    recommendations: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
          },
          score: {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
          priority: {
            type: "integer",
            enum: [1, 2, 3],
          },
          reason: {
            type: "string",
          },
        },
        required: [
          "product_id",
          "score",
          "priority",
          "reason",
        ],
        additionalProperties: false,
      },
    },
  },
  required: [
    "contract_version",
    "recommendations",
  ],
  additionalProperties: false,
};


export function validateAiRecommendations(payload, candidates) {
  if (
    !payload ||
    payload.contract_version !== CONTRACT_VERSION ||
    !Array.isArray(payload.recommendations) ||
    payload.recommendations.length > 3
  ) {
    throw new Error("INVALID_AI_CONTRACT");
  }

  const candidateIds = new Set(
    candidates
      .filter((candidate) => candidate.availableForSale === true)
      .map((candidate) => candidate.id)
  );

  const seenIds = new Set();
  const seenPriorities = new Set();

  for (const item of payload.recommendations) {
    if (
      typeof item.product_id !== "string" ||
      !candidateIds.has(item.product_id) ||
      seenIds.has(item.product_id) ||
      typeof item.score !== "number" ||
      !Number.isFinite(item.score) ||
      item.score < 0 ||
      item.score > 100 ||
      !Number.isInteger(item.priority) ||
      item.priority < 1 ||
      item.priority > 3 ||
      seenPriorities.has(item.priority) ||
      typeof item.reason !== "string" ||
      !item.reason.trim()
    ) {
      throw new Error("INVALID_AI_RECOMMENDATION");
    }

    seenIds.add(item.product_id);
    seenPriorities.add(item.priority);
  }

  return {
    contract_version: CONTRACT_VERSION,
    recommendations: [...payload.recommendations]
      .sort(
        (a, b) =>
          a.priority - b.priority
      )
      .map((item, index) => ({
        product_id: item.product_id,
        score: item.score,
        priority: index + 1,
        reason: item.reason.trim(),
      })),
  };
}

//Que la IA devuelva el contrato correcto.
//Que no recomiende IDs ajenos a los candidatos disponibles.
//Que no repita productos ni prioridades.
//Que la puntuación esté entre 0 y 100.
//Que cada recomendación tenga una razón válida.


export async function rankCandidatesWithAI({
  answers,
  candidates,
}) {
  // Si no hay clave API, el endpoint podrá usar el Motor V1.
  if (!openai) {
    return null;
  }

  // La IA solo recibe productos disponibles.
  const availableCandidates = candidates.filter(
    (candidate) =>
      candidate.availableForSale === true &&
      typeof candidate.id === "string"
  );

  if (availableCandidates.length === 0) {
    return {
      contract_version: CONTRACT_VERSION,
      recommendations: [],
    };
  }

  const input = {
    contract_version: CONTRACT_VERSION,
    answers,
    candidates: availableCandidates.map((candidate) => ({
      product_id: candidate.id,
      title: candidate.title,
      product_type: candidate.productType || "",
      tags: candidate.tags || [],
      price: Number(candidate.price),
      currency: candidate.currencyCode || "",
      available_for_sale: true,
      ...(candidate.vendor
        ? { vendor: candidate.vendor }
        : {}),
    })),
    max_recommendations: 3,
  };

  const response = await openai.responses.create({
    model: MODEL,

    instructions: [
      "Eres el selector de productos de CBI-Market.",
      "Selecciona hasta tres productos entre los candidatos recibidos.",
      "Utiliza exclusivamente los datos proporcionados.",
      "No inventes características ni identificadores.",
      "Justifica cada recomendación con las respuestas y los datos disponibles.",
      "Respeta exactamente el esquema de salida solicitado.",
    ].join(" "),

    input: JSON.stringify(input),
    max_output_tokens: 1200,

    text: {
      format: {
        type: "json_schema",
        name: "cbi_market_recommendations",
        strict: true,
        schema: recommendationSchema,
      },
    },
  });

  if (!response.output_text) {
    throw new Error("EMPTY_AI_RESPONSE");
  }

  let payload;

  try {
    payload = JSON.parse(response.output_text);
  } catch {
    throw new Error("INVALID_AI_JSON");
  }

  return validateAiRecommendations(
    payload,
    availableCandidates
  );
}

//Comprueba si existe una clave API. Si no existe, devuelve null para permitir el respaldo del Motor V1.
//Filtra los candidatos disponibles.
//Envía a OpenAI solo los datos necesarios del cuestionario y de los productos.
//Solicita una respuesta estructurada con nuestro esquema.
//Convierte la respuesta JSON y la pasa por el validador antes de devolverla.

