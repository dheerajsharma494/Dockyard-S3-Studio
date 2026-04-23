import { getS3Client } from "@/app/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(req) {
  try {
    const s3 = await getS3Client();
    const { bucket, key, expiresIn } = await req.json();

    if (!bucket || !key) {
      return Response.json(
        { error: "bucket and key are required" },
        { status: 400 },
      );
    }

    const ttl = Number(expiresIn) || 900;
    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: Math.min(Math.max(ttl, 60), 604800) },
    );

    return Response.json({ success: true, signedUrl, expiresIn: ttl });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to generate signed URL" },
      { status: 500 },
    );
  }
}
