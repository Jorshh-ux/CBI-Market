import test from "node:test";
import assert from "node:assert/strict";
import {
  assessRecommendationQuality,
  prepareRecommendationCandidates,
} from "./product-recommendations.server.js";

const catalog = [
  makeProduct("board-beginner-classic", "Snowboard Classic Beginner", 200, ["principiante", "clasico"]),
  makeProduct("board-advanced-classic", "Snowboard Classic Advanced", 250, ["avanzado", "clasico"]),
  makeProduct("board-intermediate-classic", "Snowboard Classic Intermediate", 400, ["intermedio", "clasico"]),
  makeProduct("board-beginner-premium", "Snowboard Premium Beginner", 700, ["principiante", "premium"]),
  makeProduct("board-advanced-premium", "Snowboard Premium Advanced", 900, ["avanzado", "premium"]),
  makeProduct("ski-wax", "Selling Plans Ski Wax", 9, ["wax"], "accessories"),
];

const combinations = [
  {
    name: "Principiante + Económico + snowboard clásico",
    answers: ["Principiante,", "Económico", "snowboard clásico"],
    expected: "board-beginner-classic",
  },
  {
    name: "Avanzado + Premium + snowboard premium",
    answers: ["Avanzado.", "Premium.", "snowboard premium"],
    expected: "board-advanced-premium",
  },
  {
    name: "Intermedio + Equilibrado + snowboard clásico",
    answers: ["Intermedio,", "Equilibrado", "snowboard clásico"],
    expected: "board-intermediate-classic",
  },
  {
    name: "Principiante + Premium + snowboard premium",
    answers: ["Principiante,", "Premium.", "snowboard premium"],
    expected: "board-beginner-premium",
  },
  {
    name: "Avanzado + Económico + snowboard clásico",
    answers: ["Avanzado.", "Económico", "snowboard clásico"],
    expected: "board-advanced-classic",
  },
];

for (const combination of combinations) {
  test(combination.name, () => {
    const { eligibleProducts, ruleCandidates, aiCandidatePool } =
      prepareRecommendationCandidates(catalog, makeAnswers(combination.answers));

    assert.ok(eligibleProducts.length > 0);
    assert.ok(ruleCandidates.length > 0);
    assert.ok(aiCandidatePool.length > 0);
    assert.equal(ruleCandidates[0].id, combination.expected);
    assert.ok(aiCandidatePool.every((product) => product.productType === "snowboard"));
    assert.ok(aiCandidatePool.every((product) => product.image && product.price !== null));
  });
}

test("marca para revisión una respuesta débil de IA", () => {
  const issues = assessRecommendationQuality({
    recommendations: [
      { id: "weak-product", score: 42, reasons: ["Buena opción"] },
    ],
    answers: makeAnswers(["Avanzado", "Económico", "snowboard premium"]),
    engine: "openai",
  });

  assert.deepEqual(issues, [
    "low_ai_score",
    "budget_not_explained",
    "level_not_matched",
    "snowboard_style_not_matched",
  ]);
});

function makeAnswers([level, budget, type]) {
  return [
    { question: "que nivel prefieres?", label: level, value: level.toLowerCase() },
    { question: "¿Qué presupuesto tienes?", label: budget, value: budget.toLowerCase() },
    { question: "que snowboard buscas?", label: type, value: type.toLowerCase().replaceAll(" ", "-") },
  ];
}

function makeProduct(id, title, price, tags, productType = "snowboard") {
  return {
    id,
    title,
    handle: id,
    productType,
    vendor: "Test vendor",
    tags: [productType, ...tags],
    featuredImage: { url: `https://example.test/${id}.jpg`, altText: title },
    priceRangeV2: { minVariantPrice: { amount: String(price), currencyCode: "USD" } },
    onlineStoreUrl: `/products/${id}`,
  };
}
