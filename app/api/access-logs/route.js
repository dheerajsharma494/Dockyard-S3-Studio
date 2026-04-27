import { getS3Client } from "@/app/lib/s3";
import {
  GetBucketLoggingCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  try {
    const s3 = await getS3Client();
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket");
    const limit = Number(searchParams.get("limit") || 100);

    if (!bucket) {
      return Response.json({ error: "bucket is required" }, { status: 400 });
    }

    const logging = await s3.send(
      new GetBucketLoggingCommand({ Bucket: bucket }),
    );
    const loggingEnabled = logging.LoggingEnabled;

    if (!loggingEnabled?.TargetBucket) {
      return Response.json({ success: true, loggingEnabled: null, logs: [] });
    }

    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: loggingEnabled.TargetBucket,
        Prefix: loggingEnabled.TargetPrefix || "",
        MaxKeys: Math.min(Math.max(limit, 1), 1000),
      }),
    );

    return Response.json({
      success: true,
      loggingEnabled,
      logs: (listed.Contents || []).map((item) => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        storageClass: item.StorageClass,
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to fetch access logs" },
      { status: 500 },
    );
  }
}
