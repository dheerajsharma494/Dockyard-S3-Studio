import { listWebhooks } from "@/app/lib/webhooks-store";

export async function emitWebhook(event, payload) {
  try {
    const webhooks = await listWebhooks();
    const targets = webhooks.filter(
      (w) => w.enabled && (w.event === "*" || w.event === event),
    );

    await Promise.allSettled(
      targets.map((webhook) =>
        fetch(webhook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            payload,
          }),
        }),
      ),
    );
  } catch {
    // Best effort only: webhook delivery failures should not block S3 operations.
  }
}
