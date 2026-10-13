import prisma from "./app/db.server.js";

try {
  const quizzes = await prisma.quiz.findMany({
    include: {
      storeSettings: true,
      questions: {
        orderBy: { position: "asc" },
        include: {
          options: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  console.log(
    JSON.stringify(
      quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        isActive: q.isActive,
        shopDomain: q.storeSettings.shopDomain,
        questions: q.questions.map((p) => ({
          text: p.text,
          type: p.type,
          options: p.options.map((o) => o.label),
        })),
      })),
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
