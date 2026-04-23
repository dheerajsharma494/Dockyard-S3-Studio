import {
  deleteConnection,
  updateConnection,
} from "@/app/lib/connections-store";

export async function PUT(req, { params }) {
  const payload = await req.json();
  const result = await updateConnection(params.id, payload);

  if (!result) {
    return Response.json({ error: "Connection not found" }, { status: 404 });
  }

  return Response.json(result);
}

export async function DELETE(_req, { params }) {
  const store = await deleteConnection(params.id);

  if (!store) {
    return Response.json({ error: "Connection not found" }, { status: 404 });
  }

  return Response.json(store);
}
