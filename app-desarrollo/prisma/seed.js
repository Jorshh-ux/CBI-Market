
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.storeSettings.upsert({
    where: {
      shopDomain: "demo-cbi-market.myshopify.com",
    },
    update: {},
    create: {
      shopDomain: "demo-cbi-market.myshopify.com",
      recommendationLimit: 3,
    },
  });

  const quiz = await prisma.quiz.upsert({
    where: { id: "seed-quiz" },
    update: {
      title: "Cuestionario de prueba",
      description: "Datos de prueba para CBI-Market",
      isActive: true,
      storeSettingsId: store.id,
    },
    create: {
      id: "seed-quiz",
      title: "Cuestionario de prueba",
      description: "Datos de prueba para CBI-Market",
      isActive: true,
      storeSettingsId: store.id,
    },
  });

  const question = await prisma.question.upsert({
    where: { id: "seed-question-1" },
    update: {
      text: "¿Qué tipo de producto buscas?",
      type: "SINGLE_CHOICE",
      position: 0,
      required: true,
      quizId: quiz.id,
    },
    create: {
      id: "seed-question-1",
      text: "¿Qué tipo de producto buscas?",
      type: "SINGLE_CHOICE",
      position: 0,
      required: true,
      quizId: quiz.id,
    },
  });

  const options = [
    { id: "seed-option-1", label: "Económico", value: "budget", position: 0 },
    { id: "seed-option-2", label: "Equilibrado", value: "balanced", position: 1 },
    { id: "seed-option-3", label: "Premium", value: "premium", position: 2 },
  ];

  for (const option of options) {
    await prisma.option.upsert({
      where: { id: option.id },
      update: {
        label: option.label,
        value: option.value,
        position: option.position,
        questionId: question.id,
      },
      create: {
        ...option,
        questionId: question.id,
      },
    });
  }

  const result = await prisma.quiz.findUnique({
    where: { id: quiz.id },
    include: {
      storeSettings: true,
      questions: {
        include: {
          options: {
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
