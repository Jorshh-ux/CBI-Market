import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { payload, session, topic } = await authenticate.webhook(request);

  const current = payload.current;

  if (session) {
    try {
      await db.session.update({
        where: { id: session.id },
        data: { scope: current.toString() },
      });
      console.info("Shopify app scopes updated", { topic });
    } catch (error) {
      console.error("Shopify app scope update failed", {
        topic,
        errorName: error?.name || "Error",
      });
      return new Response("Temporary scope update failure", { status: 500 });
    }
  }

  return new Response();
};
