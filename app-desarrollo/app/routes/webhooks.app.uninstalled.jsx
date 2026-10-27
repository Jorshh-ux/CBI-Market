import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  try {
    // Idempotent cleanup: uninstall webhooks can be retried, and no session may remain.
    // StoreSettings cascades to this shop's quizzes, questions, and options.
    const [sessions, settings] = await db.$transaction([
      db.session.deleteMany({ where: { shop } }),
      db.storeSettings.deleteMany({ where: { shopDomain: shop } }),
    ]);

    console.info("Shopify app uninstall cleanup completed", {
      topic,
      sessionsDeleted: sessions.count,
      storeSettingsDeleted: settings.count,
    });
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Shopify app uninstall cleanup failed", {
      topic,
      errorName: error?.name || "Error",
    });
    // A 5xx lets Shopify retry the webhook; do not acknowledge failed cleanup.
    return new Response("Temporary cleanup failure", { status: 500 });
  }
};
