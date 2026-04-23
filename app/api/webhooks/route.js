import {
  addWebhook,
  listWebhooks,
  removeWebhook,
} from "@/app/lib/webhooks-store";

export async function GET() {
  const webhooks = await listWebhooks();
  return Response.json({ webhooks });
}

export async function POST(req) {
  const { url, event = "*", enabled = true } = await req.json();
  if (!url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }
  const webhook = await addWebhook({ url, event, enabled });
  return Response.json({ success: true, webhook });
}

export async function DELETE(req) {
  const { id } = await req.json();
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  const deleted = await removeWebhook(id);
  return Response.json({ success: deleted });
}
