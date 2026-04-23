import { getS3Client } from "@/app/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(req) {
  const s3 = await getS3Client();
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket");
  const key = searchParams.get("key");
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

  const headers = {
    "Content-Disposition": `${dispositionType}; filename="${fileName}"`,
    "Accept-Ranges": "bytes",
  };

  if (data.ContentType) {
    headers["Content-Type"] = data.ContentType;
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
