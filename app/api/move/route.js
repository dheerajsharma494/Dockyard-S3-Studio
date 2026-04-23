import { getS3Client } from "@/app/lib/s3";
import { emitWebhook } from "@/app/lib/webhooks";
import { CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export async function POST(req) {
  const s3 = await getS3Client();
  const { bucket, sourceKey, destinationKey } = await req.json();

  if (!bucket || !sourceKey || !destinationKey) {
    return Response.json(
      { error: "bucket, sourceKey and destinationKey are required" },
      { status: 400 },
    );
  }

  const encodedSource = encodeURIComponent(`${bucket}/${sourceKey}`);

  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: encodedSource,
      Key: destinationKey,
    }),
  );

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: sourceKey,
    }),
  );

  await emitWebhook("object.moved", { bucket, sourceKey, destinationKey });

  return Response.json({ success: true, destinationKey });
}
