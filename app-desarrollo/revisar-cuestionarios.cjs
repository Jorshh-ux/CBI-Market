const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const quizzes = await prisma.quiz.findMany({
    include: {
      storeSettings: true,
      questions: {
        orderBy: { position: "asc" },
        include: {
          options: {
            orderBy: { position: "asc" }
          }
        }
      }
    }
  });

  const result = quizzes.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    active: quiz.isActive,
    shop: quiz.storeSettings.shopDomain,
    questions: quiz.questions.length
  }));

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
