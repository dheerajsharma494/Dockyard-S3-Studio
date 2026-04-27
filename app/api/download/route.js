import { getS3Client } from "@/app/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function inferContentTypeFromKey(key = "") {
  const lower = key.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".ogg") || lower.endsWith(".ogv")) return "video/ogg";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".avi")) return "video/x-msvideo";
  return null;
}

export async function GET(req) {
  const s3 = await getS3Client();
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket");
  const key = searchParams.get("key");
  const forcedContentType = searchParams.get("contentType") || null;
  if (!bucket || !key) {
    return Response.json(
      { error: "bucket and key are required" },
      { status: 400 },
    );
  }

  const inline = searchParams.get("inline") === "1";
  const range = req.headers.get("range") || undefined;

  const data = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(range ? { Range: range } : {}),
    }),
  );

  const fileName = key.split("/").pop() || key;
  const dispositionType = inline ? "inline" : "attachment";
  const inferredType = inferContentTypeFromKey(key);
  const contentType =
    forcedContentType ||
    (data.ContentType && data.ContentType !== "application/octet-stream"
      ? data.ContentType
      : inferredType || data.ContentType);

  const headers = {
    "Content-Disposition": `${dispositionType}; filename="${fileName}"`,
    "Accept-Ranges": "bytes",
  };

  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  if (typeof data.ContentLength === "number") {
    headers["Content-Length"] = String(data.ContentLength);
  }
  if (data.ContentRange) {
    headers["Content-Range"] = data.ContentRange;
  }

  return new Response(data.Body, {
    status: data.ContentRange ? 206 : 200,
    headers,
  });
}
