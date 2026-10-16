const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const questions = await prisma.question.findMany({
    orderBy: [
      { quizId: "asc" },
      { position: "asc" }
    ],
    include: {
      quiz: {
        select: {
          title: true,
          storeSettings: {
            select: {
              shopDomain: true
            }
          }
        }
      },
      options: {
        orderBy: {
          position: "asc"
        }
      }
    }
  });

  const result = questions.map((q) => ({
    tienda: q.quiz.storeSettings.shopDomain,
    cuestionario: q.quiz.title,
    pregunta: q.text,
    tipo: q.type,
    obligatoria: q.required,
    opciones: q.options.map((o) => ({
      etiqueta: o.label,
      valor: o.value
    }))
  }));

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
