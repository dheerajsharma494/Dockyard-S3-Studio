import { getS3Client } from "@/app/lib/s3";
import { ListBucketsCommand } from "@aws-sdk/client-s3";

export async function GET() {
  const s3 = await getS3Client();
  const data = await s3.send(new ListBucketsCommand({}));
  return Response.json(data.Buckets);
}
