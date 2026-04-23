import { getS3Client } from "@/app/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(req) {
  const s3 = await getS3Client();
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket");
  const key = searchParams.get("key");

  const data = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  return new Response(data.Body, {
    headers: {
      "Content-Disposition": `attachment; filename="${key}"`,
    },
  });
}
