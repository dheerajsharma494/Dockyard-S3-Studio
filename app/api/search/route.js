import { getS3Client } from "@/app/lib/s3";
import { ListBucketsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 300;
const MAX_LIMIT = 1000;

export async function GET(req) {
  try {
    const s3 = await getS3Client();
    const { searchParams } = new URL(req.url);

    const query = (searchParams.get("query") || "").trim().toLowerCase();
    const requestedLimit = Number(searchParams.get("limit") || DEFAULT_LIMIT);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(
        1,
        Number.isFinite(requestedLimit) ? requestedLimit : DEFAULT_LIMIT,
      ),
    );

    if (query.length < 2) {
      return Response.json(
        { error: "query must be at least 2 characters" },
        { status: 400 },
      );
    }

    const bucketNamesParam = (searchParams.get("buckets") || "")
      .split(",")
      .map((bucket) => bucket.trim())
      .filter(Boolean);

    let bucketNames = bucketNamesParam;
    if (bucketNames.length === 0) {
      const bucketData = await s3.send(new ListBucketsCommand({}));
      bucketNames = (bucketData.Buckets || [])
        .map((bucket) => bucket.Name)
        .filter(Boolean);
    }

    const results = [];
    let scannedBuckets = 0;
    let truncated = false;

    for (const bucket of bucketNames) {
      scannedBuckets += 1;
      let continuationToken;

      do {
        const page = await s3.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken: continuationToken,
          }),
        );

        for (const object of page.Contents || []) {
          const key = object.Key || "";
          if (!key.toLowerCase().includes(query)) {
            continue;
          }

          results.push({
            bucket,
            key,
            size: Number(object.Size || 0),
            lastModified: object.LastModified || null,
            storageClass: object.StorageClass || "STANDARD",
          });

          if (results.length >= limit) {
            truncated = true;
            break;
          }
        }

        if (results.length >= limit) {
          break;
        }

        continuationToken = page.IsTruncated
          ? page.NextContinuationToken
          : undefined;
      } while (continuationToken);

      if (results.length >= limit) {
        break;
      }
    }

    return Response.json({
      query,
      results,
      scannedBuckets,
      truncated,
      limit,
    });
  } catch (error) {
    const code = error?.name || error?.Code || "UnknownError";
    const message = error?.message || "Failed to search objects";
    return Response.json({ error: `${code}: ${message}` }, { status: 500 });
  }
}
