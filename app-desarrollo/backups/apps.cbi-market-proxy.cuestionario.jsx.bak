
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session?.shop) {
      return Response.json(
        { error: "No se pudo identificar la tienda." },
        { status: 401 }
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
        { status: 404 }
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
            options: {
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });

    if (!quiz) {
      return Response.json(
        { error: "No se encontró un cuestionario activo." },
        { status: 404 }
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
      { status: 500 }
    );
  }
}
