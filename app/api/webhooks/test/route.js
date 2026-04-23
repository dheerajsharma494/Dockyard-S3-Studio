import { getWebhookById } from "@/app/lib/webhooks-store";

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

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
