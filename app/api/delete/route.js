import { s3 } from "@/app/lib/s3";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

export async function DELETE(req) {
  const { bucket, key } = await req.json();

  await s3.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key
  }));

  return Response.json({ success: true });
}
