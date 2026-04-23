import { createConnection, listConnections } from "@/app/lib/connections-store";

export async function GET() {
  const store = await listConnections();
  return Response.json(store);
}

export async function POST(req) {
  const payload = await req.json();
  const { store, connection } = await createConnection(payload);
  return Response.json({ store, connection }, { status: 201 });
}
