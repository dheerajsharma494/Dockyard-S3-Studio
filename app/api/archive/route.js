import { getS3Client } from "@/app/lib/s3";
import { HeadObjectCommand, RestoreObjectCommand } from "@aws-sdk/client-s3";

export async function GET(req) {
  try {
    const s3 = await getS3Client();
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket");
    const key = searchParams.get("key");

    if (!bucket || !key) {
      return Response.json(
        { error: "bucket and key are required" },
        { status: 400 },
      );
    }

    const head = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );

    return Response.json({
      success: true,
      storageClass: head.StorageClass || "STANDARD",
      restore: head.Restore || null,
      archiveStatus: head.ArchiveStatus || null,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to get archive status" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const s3 = await getS3Client();
    const { bucket, key, days = 7, tier = "Standard" } = await req.json();

    if (!bucket || !key) {
      return Response.json(
        { error: "bucket and key are required" },
        { status: 400 },
      );
    }

    await s3.send(
      new RestoreObjectCommand({
        Bucket: bucket,
        Key: key,
        RestoreRequest: {
          Days: Number(days),
          GlacierJobParameters: { Tier: tier },
        },
      }),
    );

    return Response.json({
      success: true,
      message: "Restore request initiated",
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to initiate restore" },
      { status: 500 },
    );
  }
}
