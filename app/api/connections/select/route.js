import { setActiveConnection } from "@/app/lib/connections-store";

export async function POST(req) {
  const payload = await req.json();
  const store = await setActiveConnection(payload.id);

  if (!store) {
    return Response.json({ error: "Connection not found" }, { status: 404 });
  }

  return Response.json(store);
}
