import { getS3Client } from "@/app/lib/s3";
import { CopyObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

async function listAllObjects(s3, bucket, prefix) {
  const result = [];
  let continuationToken;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    result.push(...(page.Contents || []));
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return result;
}

export async function POST(req) {
  try {
    const s3 = await getS3Client();
    const {
      sourceBucket,
      sourcePrefix = "",
      destinationBucket,
      destinationPrefix = "",
      dryRun = true,
    } = await req.json();

    if (!sourceBucket || !destinationBucket) {
      return Response.json(
        { error: "sourceBucket and destinationBucket are required" },
        { status: 400 },
      );
    }

    const sourceObjects = await listAllObjects(s3, sourceBucket, sourcePrefix);

    const plan = sourceObjects
      .filter((obj) => obj.Key && !obj.Key.endsWith("/"))
      .map((obj) => {
        const relative = obj.Key.replace(sourcePrefix, "");
        return {
          sourceKey: obj.Key,
          destinationKey: `${destinationPrefix}${relative}`,
          size: obj.Size,
        };
      });

    if (!dryRun) {
      for (const item of plan) {
        await s3.send(
          new CopyObjectCommand({
            Bucket: destinationBucket,
            CopySource: encodeURIComponent(`${sourceBucket}/${item.sourceKey}`),
            Key: item.destinationKey,
          }),
        );
      }
    }

    return Response.json({ success: true, dryRun, total: plan.length, plan });
  } catch (error) {
    return Response.json(
      { error: error.message || "Sync operation failed" },
      { status: 500 },
    );
  }
}
