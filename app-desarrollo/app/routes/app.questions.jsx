import { useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

async function getOrCreateQuiz(shopDomain) {
  const store = await prisma.storeSettings.upsert({
    where: { shopDomain },
    update: {},
    create: { shopDomain },
  });

  let quiz = await prisma.quiz.findFirst({
    where: { storeSettingsId: store.id },
    orderBy: { createdAt: "asc" },
  });

  if (!quiz) {
    quiz = await prisma.quiz.create({
      data: {
        title: "Cuestionario de recomendación",
        isActive: true,
        storeSettingsId: store.id,
      },
    });
  }

  return quiz;
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const quiz = await getOrCreateQuiz(session.shop);

  const questions = await prisma.question.findMany({
    where: { quizId: quiz.id },
    orderBy: { position: "asc" },
    include: {
      options: { orderBy: { position: "asc" } },
    },
  });

  return { quiz, questions };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const quiz = await getOrCreateQuiz(session.shop);
  const formData = await request.formData();
  const intentValue = formData.get("intent");
  const intent = typeof intentValue === "string" ? intentValue : "";

  try {
    if (intent === "save") {
      const id = String(formData.get("id") || "");
      const text = String(formData.get("text") || "").trim();
      const type = String(formData.get("type") || "SINGLE_CHOICE");
      const required = formData.get("required") === "on";
      const rawOptions = String(formData.get("options") || "");
      const optionLabels = rawOptions
        .split("\n")
        .map((label) => label.trim())
        .filter(Boolean);

      if (!text || text.length > 240) {
        return { error: "Escribe una pregunta de hasta 240 caracteres." };
      }
      if (rawOptions.length > 4000) {
        return { error: "Las opciones superan el límite permitido." };
      }

      if (!["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TEXT"].includes(type)) {
        return { error: "El tipo de pregunta no es válido." };
      }

      if (type !== "TEXT" && optionLabels.length < 2) {
        return {
          error: "Agrega al menos dos opciones para este tipo de pregunta.",
        };
      }

      if (
        optionLabels.length > 20 ||
        optionLabels.some((label) => label.length > 120)
      ) {
        return { error: "Agrega hasta 20 opciones de máximo 120 caracteres." };
      }
      const normalizedOptions = optionLabels.map((label) =>
        label.toLocaleLowerCase(),
      );
      if (new Set(normalizedOptions).size !== normalizedOptions.length) {
        return { error: "No repitas opciones en la misma pregunta." };
      }

      if (type === "TEXT" && optionLabels.length > 0) {
        return {
          error: "Las preguntas de texto libre no deben tener opciones.",
        };
      }

      if (id && id.length > 128) {
        return { error: "La pregunta indicada no es válida." };
      }

      const data = { text, type, required, quizId: quiz.id };

      if (id) {
        const existing = await prisma.question.findFirst({
          where: { id, quizId: quiz.id },
        });

        if (!existing) {
          return { error: "No se encontró esa pregunta." };
        }

        await prisma.$transaction(async (tx) => {
          await tx.question.update({
            where: { id },
            data: { text, type, required },
          });

          await tx.option.deleteMany({ where: { questionId: id } });

          if (type !== "TEXT") {
            await tx.option.createMany({
              data: optionLabels.map((label, position) => ({
                label,
                value: label.toLowerCase().replace(/\s+/g, "-"),
                position,
                questionId: id,
              })),
            });
          }
        });

        return { success: "Pregunta actualizada correctamente." };
      }

      const lastQuestion = await prisma.question.findFirst({
        where: { quizId: quiz.id },
        orderBy: { position: "desc" },
      });

      if ((lastQuestion?.position ?? -1) >= 49) {
        return {
          error: "El cuestionario puede tener como máximo 50 preguntas.",
        };
      }

      await prisma.question.create({
        data: {
          ...data,
          position: (lastQuestion?.position ?? -1) + 1,
          options:
            type === "TEXT"
              ? undefined
              : {
                  create: optionLabels.map((label, position) => ({
                    label,
                    value: label.toLowerCase().replace(/\s+/g, "-"),
                    position,
                  })),
                },
        },
      });

      return { success: "Pregunta creada correctamente." };
    }

    if (intent === "delete") {
      const id = String(formData.get("id") || "");
      if (!id || id.length > 128)
        return { error: "La pregunta indicada no es válida." };
      const question = await prisma.question.findFirst({
        where: { id, quizId: quiz.id },
      });

      if (!question) {
        return { error: "No se encontró esa pregunta." };
      }

      await prisma.$transaction(async (tx) => {
        await tx.question.delete({ where: { id } });

        const remaining = await tx.question.findMany({
          where: { quizId: quiz.id },
          orderBy: { position: "asc" },
        });

        for (let index = 0; index < remaining.length; index++) {
          await tx.question.update({
            where: { id: remaining[index].id },
            data: { position: index },
          });
        }
      });

      return { success: "Pregunta eliminada correctamente." };
    }

    if (intent === "move") {
      const id = String(formData.get("id") || "");
      const direction = String(formData.get("direction") || "");
      if (!id || id.length > 128 || !["up", "down"].includes(direction)) {
        return { error: "La solicitud para mover la pregunta no es válida." };
      }

      const questions = await prisma.question.findMany({
        where: { quizId: quiz.id },
        orderBy: { position: "asc" },
      });

      const index = questions.findIndex((question) => question.id === id);
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (index < 0 || targetIndex < 0 || targetIndex >= questions.length) {
        return { error: "No se puede mover la pregunta en esa dirección." };
      }

      await prisma.$transaction(async (tx) => {
        const current = questions[index];
        const target = questions[targetIndex];

        // Usar una posición temporal evita colisiones con la restricción única.
        await tx.question.update({
          where: { id: current.id },
          data: { position: -1 },
        });

        await tx.question.update({
          where: { id: target.id },
          data: { position: current.position },
        });

        await tx.question.update({
          where: { id: current.id },
          data: { position: target.position },
        });
      });

      return { success: "Orden actualizado correctamente." };
    }

    return { error: "Operación no reconocida." };
  } catch (error) {
    console.error("Admin question mutation failed", {
      intent,
      errorName: error?.name || "Error",
    });
    return {
      error:
        "No se pudo guardar el cambio. Revisa los datos e inténtalo otra vez.",
    };
  }
};

export default function QuestionsPage() {
  const { quiz, questions } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const editingId = fetcher.formData?.get("id");
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(fetcher.data.success);
    }
  }, [fetcher.data, shopify]);

  return (
    <s-page heading="Administrador de preguntas">
      <s-section heading={quiz.title}>
        <s-paragraph>
          Crea y organiza las preguntas que utilizará tu cuestionario de
          recomendación.
        </s-paragraph>

        {fetcher.data?.error && (
          <s-banner tone="critical">{fetcher.data.error}</s-banner>
        )}

        {fetcher.data?.success && (
          <s-banner tone="success">{fetcher.data.success}</s-banner>
        )}

        {questions.length === 0 ? (
          <s-paragraph>
            Todavía no hay preguntas. Puedes crear la primera con el formulario.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {questions.map((question, index) => (
              <s-box
                key={question.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="small">
                  <s-heading>{`${index + 1}. ${question.text}`}</s-heading>
                  <s-text>
                    Tipo: {question.type} ·{" "}
                    {question.required ? "Obligatoria" : "Opcional"}
                  </s-text>

                  {question.options.map((option) => (
                    <s-text key={option.id}>• {option.label}</s-text>
                  ))}

                  <s-stack direction="inline" gap="small">
                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById("question-id").value =
                          question.id;
                        document.getElementById("question-text").value =
                          question.text;
                        document.getElementById("question-type").value =
                          question.type;
                        document.getElementById("question-required").checked =
                          question.required;
                        document.getElementById("question-options").value =
                          question.options
                            .map((option) => option.label)
                            .join("\n");
                        document
                          .getElementById("question-form")
                          .scrollIntoView({
                            behavior: "smooth",
                          });
                      }}
                    >
                      Editar
                    </button>

                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="move" />
                      <input type="hidden" name="id" value={question.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit" disabled={busy || index === 0}>
                        Subir
                      </button>
                    </fetcher.Form>

                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="move" />
                      <input type="hidden" name="id" value={question.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={busy || index === questions.length - 1}
                      >
                        Bajar
                      </button>
                    </fetcher.Form>

                    <fetcher.Form
                      method="post"
                      onSubmit={(event) => {
                        if (!window.confirm("¿Eliminar esta pregunta?")) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={question.id} />
                      <button type="submit" disabled={busy}>
                        Eliminar
                      </button>
                    </fetcher.Form>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>

      <s-section heading="Crear o editar pregunta">
        <fetcher.Form id="question-form" method="post">
          <input type="hidden" name="intent" value="save" />
          <input id="question-id" type="hidden" name="id" />

          <s-stack direction="block" gap="base">
            <s-text-field
              id="question-text"
              name="text"
              label="Texto de la pregunta"
              required
            />

            <s-select
              id="question-type"
              name="type"
              label="Tipo de pregunta"
              value="SINGLE_CHOICE"
              required
            >
              <s-option value="SINGLE_CHOICE">Una opción</s-option>
              <s-option value="MULTIPLE_CHOICE">Varias opciones</s-option>
              <s-option value="TEXT">Texto libre</s-option>
            </s-select>

            <s-text-area
              id="question-options"
              name="options"
              label="Opciones (una por línea; mínimo dos, excepto texto libre)"
            />

            <s-checkbox
              id="question-required"
              name="required"
              label="Respuesta obligatoria"
              checked
            />

            <s-stack direction="inline" gap="base">
              <button type="submit" disabled={busy}>
                Guardar pregunta
              </button>
              <button
                type="button"
                onClick={() => {
                  document.getElementById("question-form").reset();
                  document.getElementById("question-id").value = "";
                }}
              >
                Limpiar formulario
              </button>
            </s-stack>
          </s-stack>
        </fetcher.Form>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
