import {
  deleteConnection,
  updateConnection,
} from "@/app/lib/connections-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PUT(req, { params }) {
  const { id } = await params;
  const payload = await req.json();
  const result = await updateConnection(id, payload);

  if (!result) {
    return Response.json({ error: "Connection not found" }, { status: 404 });
  }

  return Response.json(result);
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  const store = await deleteConnection(id);

  if (!store) {
    return Response.json({ error: "Connection not found" }, { status: 404 });
  }

  return Response.json(store);
}
