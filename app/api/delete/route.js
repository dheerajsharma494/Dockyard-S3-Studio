import { getS3Client } from "@/app/lib/s3";
import { emitWebhook } from "@/app/lib/webhooks";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

export async function DELETE(req) {
  const s3 = await getS3Client();
  const { bucket, key } = await req.json();

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  await emitWebhook("object.deleted", { bucket, key });

  return Response.json({ success: true });
}
