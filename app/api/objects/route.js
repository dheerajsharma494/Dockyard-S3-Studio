import { getS3Client } from "@/app/lib/s3";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  try {
    const s3 = await getS3Client();
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket");
    const prefix = searchParams.get("prefix") || "";
    const recursive = searchParams.get("recursive") === "1";

    if (!bucket) {
      return Response.json({ error: "bucket is required" }, { status: 400 });
    }

    let continuationToken;
    const folders = [];
    const files = [];

    do {
      const input = {
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      };

      if (!recursive) {
        input.Delimiter = "/";
      }

      const data = await s3.send(new ListObjectsV2Command(input));
      if (!recursive) {
        folders.push(...(data.CommonPrefixes || []));
      }
      files.push(...(data.Contents || []));
      continuationToken = data.IsTruncated
        ? data.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return Response.json({
      folders,
      files,
    });
  } catch (error) {
    const code = error?.name || error?.Code || "UnknownError";
    const message = error?.message || "Failed to list objects";

    if (code === "AccessDenied") {
      return Response.json(
        {
          error:
            "AccessDenied: credentials can list buckets but do not have ListBucket permission for this bucket.",
        },
        { status: 403 },
      );
    }

    if (
      code === "PermanentRedirect" ||
      code === "AuthorizationHeaderMalformed"
    ) {
      return Response.json(
        {
          error:
            "Bucket region mismatch. Update the connection region to the bucket's region.",
          details: message,
        },
        { status: 400 },
      );
    }

    return Response.json({ error: `${code}: ${message}` }, { status: 500 });
  }
}
