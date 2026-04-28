import { listWebhooks } from "@/app/lib/webhooks-store";
import { validateOutboundUrl } from "@/app/lib/network-policy";

export async function emitWebhook(event, payload) {
  try {
    const webhooks = await listWebhooks();
    const targets = webhooks.filter(
      (w) => w.enabled && (w.event === "*" || w.event === event),
    );

    await Promise.allSettled(
      targets.map((webhook) => {
        const validation = validateOutboundUrl(webhook.url);

        if (!validation.ok) {
          return Promise.reject(new Error(validation.error));
        }

        return fetch(validation.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          redirect: "error",
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            payload,
          }),
        });
      }),
    );
  } catch {
    // Best effort only: webhook delivery failures should not block S3 operations.
  }
}
