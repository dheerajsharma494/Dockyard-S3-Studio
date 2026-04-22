import { s3 } from "@/app/lib/s3";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket");
  const prefix = searchParams.get("prefix") || "";

  const data = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    Delimiter: "/"
  }));

  return Response.json({
    folders: data.CommonPrefixes || [],
    files: data.Contents || []
  });
}
