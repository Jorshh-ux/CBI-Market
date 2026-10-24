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
  const rawAmount = product.priceRangeV2?.minVariantPrice?.amount;
  if (rawAmount === null || rawAmount === undefined || rawAmount === "") return null;
  const amount = Number(rawAmount);
  return Number.isFinite(amount) ? amount : null;
}

function hasDisplayData(product) {
  return Boolean(product.featuredImage?.url) && getPrice(product) !== null;
}

function filterProductsForAnswers(products, selectedOptions) {
  const asksForSnowboard = selectedOptions.some((answer) =>
    normalize(answer.question).includes("snowboard"),
  );

  const matchingCategory = asksForSnowboard
    ? products.filter((product) =>
        normalize(
          [product.title, product.productType, ...(product.tags || [])].join(" "),
        ).includes("snowboard"),
      )
    : products;

  return matchingCategory.filter(hasDisplayData);
}

function scoreProducts(products, selectedOptions, includeUnmatched = false) {
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
    const searchable = normalize(
      [product.title, product.productType, product.vendor, ...(product.tags || [])].join(" "),
    );
    let score = 0;
    const reasons = [];

    for (const answer of selectedOptions) {
      const question = normalize(answer.question);
      const combined = normalize(`${answer.label} ${answer.value}`);

      if (question.includes("presupuesto")) {
        const price = getPrice(product);

        if (price !== null && lowLimit !== null) {
          if (/\b(economico|economica|barato|barata)\b/.test(combined) && price <= lowLimit) {
            score += 2;
            reasons.push("Está entre los snowboards de menor precio de la tienda.");
          } else if (combined.includes("premium") && highLimit !== null && price >= highLimit) {
            score += 2;
            reasons.push("Está entre los snowboards de mayor precio de la tienda.");
          } else if (
            /\b(equilibrado|equilibrada|medio|media)\b/.test(combined) &&
            lowLimit !== null && highLimit !== null &&
            price > lowLimit && price <= highLimit
          ) {
            score += 1;
            reasons.push("Está en el segmento intermedio de precios.");
          }
        }

        continue;
      }

      if (question.includes("nivel")) {
        const levels = {
          principiante: ["principiante", "beginner", "iniciacion"],
          intermedio: ["intermedio", "intermediate"],
          avanzado: ["avanzado", "advanced", "experto", "expert"],
        };
        const selectedLevel = Object.entries(levels).find(([level, aliases]) =>
          [level, ...aliases].some((word) => combined.includes(word)),
        )?.[0];

        if (selectedLevel && levels[selectedLevel].some((word) => searchable.includes(word))) {
          score += 2;
          reasons.push(`Coincide con el nivel ${selectedLevel}.`);
        }

        continue;
      }

      if (question.includes("snowboard") || question.includes("tipo")) {
        const words = [...new Set(combined.split(/\s+/))].filter(
          (word) => word.length >= 3 && !["buscas", "snowboard"].includes(word),
        );
        const matched = words.filter((word) => searchable.includes(word));

        if (matched.length) {
          score += matched.length;
          reasons.push(`Coincide con tu búsqueda: ${matched.join(", ")}.`);
        }
      }
    }

    return {
      id: product.id,
      availableForSale: product.availableForSale !== false,
      title: product.title,
      image: product.featuredImage?.url || null,
      imageAlt: product.featuredImage?.altText || product.title,
      productType: product.productType || "",
      vendor: product.vendor || "",
      tags: product.tags || [],
      handle: product.handle || "",
      price: product.priceRangeV2?.minVariantPrice?.amount ?? null,
      currencyCode: product.priceRangeV2?.minVariantPrice?.currencyCode ?? null,
      url: product.onlineStoreUrl || (product.handle ? `/products/${product.handle}` : null),
      score,
      reasons: [...new Set(reasons)],
    };
  });

  return scored
    .filter((product) => includeUnmatched || product.score > 0)
    .sort((a, b) => b.score - a.score);
}

function buildAiFallbackCandidates(products, selectedOptions, limit = 3) {
  const budgetAnswer = selectedOptions.find((answer) =>
    normalize(answer.question).includes("presupuesto"),
  );
  const budget = normalize(`${budgetAnswer?.label || ""} ${budgetAnswer?.value || ""}`);
  const preferLowPrice = /\b(economico|economica|barato|barata|low|budget)\b/.test(budget);
  const preferHighPrice = /\b(premium|caro|cara|high)\b/.test(budget);
  const answerWords = selectedOptions
    .filter((answer) => !normalize(answer.question).includes("presupuesto"))
    .flatMap((answer) => normalize(`${answer.label} ${answer.value}`).split(/\s+/))
    .filter((word) => word.length >= 4 && !["snowboard", "buscas"].includes(word));

  return scoreProducts(products, selectedOptions, true)
    .map((product) => {
      const searchable = normalize(
        [product.title, product.productType, product.vendor, ...product.tags].join(" "),
      );
      return {
        product,
        textMatches: answerWords.filter((word) => searchable.includes(word)).length,
        price: getPrice(product),
      };
    })
    .sort((a, b) => {
      if (a.textMatches !== b.textMatches) return b.textMatches - a.textMatches;
      if (a.price !== null && b.price !== null && preferLowPrice && a.price !== b.price) {
        return a.price - b.price;
      }
      if (a.price !== null && b.price !== null && preferHighPrice && a.price !== b.price) {
        return b.price - a.price;
      }
      return b.product.score - a.product.score;
    })
    .slice(0, limit)
    .map(({ product }) => product);
}

export function prepareRecommendationCandidates(products, selectedOptions) {
  const eligibleProducts = filterProductsForAnswers(products, selectedOptions);
  return {
    eligibleProducts,
    ruleCandidates: scoreProducts(eligibleProducts, selectedOptions).slice(0, 3),
    aiCandidatePool: buildAiFallbackCandidates(eligibleProducts, selectedOptions, 50),
  };
}

export function assessRecommendationQuality({ recommendations, answers, engine }) {
  const issues = [];

  if (!recommendations.length) issues.push("no_recommendations");
  if (recommendations.some((product) => !product.reasons?.some((reason) => reason.trim()))) {
    issues.push("missing_explanation");
  }
  if (engine === "openai" && recommendations.some((product) => product.score < 60)) {
    issues.push("low_ai_score");
  }

  const budgetAnswer = answers.find((answer) =>
    normalize(answer.question).includes("presupuesto"),
  );
  if (
    budgetAnswer &&
    recommendations.length &&
    !recommendations.some((product) =>
      product.reasons?.some((reason) => normalize(reason).includes("precio")),
    )
  ) {
    issues.push("budget_not_explained");
  }

  const levelAnswer = answers.find((answer) =>
    normalize(answer.question).includes("nivel"),
  );
  if (
    levelAnswer &&
    recommendations.length &&
    !recommendations.some((product) =>
      product.reasons?.some((reason) => normalize(reason).includes("coincide con el nivel")),
    )
  ) {
    issues.push("level_not_matched");
  }

  const typeAnswer = answers.find((answer) =>
    normalize(answer.question).includes("snowboard"),
  );
  if (
    typeAnswer &&
    recommendations.length &&
    !recommendations.some((product) =>
      product.reasons?.some((reason) => normalize(reason).includes("coincide con tu busqueda")),
    )
  ) {
    issues.push("snowboard_style_not_matched");
  }

  return issues;
}
