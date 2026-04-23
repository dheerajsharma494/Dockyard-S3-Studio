import { getS3Client } from "@/app/lib/s3";
import { emitWebhook } from "@/app/lib/webhooks";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const bucket = formData.get("bucket");
    const prefix = formData.get("prefix");

    if (!file || !bucket) {
      return Response.json(
        { error: "Missing file or bucket" },
        { status: 400 },
      );
    }

    const s3 = await getS3Client();
    const buffer = await file.arrayBuffer();
    const key = prefix ? `${prefix}${file.name}` : file.name;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(buffer),
        ContentType: file.type || "application/octet-stream",
      }),
    );

    await emitWebhook("object.uploaded", { bucket, key, size: file.size });

    return Response.json({
      success: true,
      key,
      name: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      { error: error.message || "Upload failed" },
      { status: 500 },
    );
  }
}
