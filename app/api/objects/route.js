import { getS3Client } from "@/app/lib/s3";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export async function GET(req) {
  const s3 = await getS3Client();
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket");
  const prefix = searchParams.get("prefix") || "";
  const recursive = searchParams.get("recursive") === "1";

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
}
