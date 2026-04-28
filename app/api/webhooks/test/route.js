import { getWebhookById } from "@/app/lib/webhooks-store";
import { validateOutboundUrl } from "@/app/lib/network-policy";

export async function POST(req) {
  try {
    const { id, url, event = "webhook.test" } = await req.json();

    let targetUrl = url;
    if (!targetUrl && id) {
      const webhook = await getWebhookById(id);
      targetUrl = webhook?.url;
    }

    if (!targetUrl) {
      return Response.json({ error: "id or url is required" }, { status: 400 });
    }

    const validation = validateOutboundUrl(targetUrl);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const response = await fetch(validation.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        payload: {
          message: "Webhook test from S3 Explorer",
        },
      }),
    });

    return Response.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Webhook test failed" },
      { status: 500 },
    );
  }
}
