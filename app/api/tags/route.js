import { getS3Client } from "@/app/lib/s3";
import {
  GetObjectTaggingCommand,
  PutObjectTaggingCommand,
} from "@aws-sdk/client-s3";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get("bucket");
    const key = searchParams.get("key");

    if (!bucket || !key) {
      return Response.json({ error: "Missing bucket or key" }, { status: 400 });
    }

    const s3 = await getS3Client();
    const response = await s3.send(
      new GetObjectTaggingCommand({ Bucket: bucket, Key: key }),
    );

    const tags = {};
    (response.TagSet || []).forEach((tag) => {
      tags[tag.Key] = tag.Value;
    });

    return Response.json({ tags });
  } catch (error) {
    console.error("Get tags error:", error);
    return Response.json(
      { error: error.message || "Failed to get tags" },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  try {
    const { bucket, key, tags } = await request.json();

    if (!bucket || !key) {
      return Response.json({ error: "Missing bucket or key" }, { status: 400 });
    }

    const s3 = await getS3Client();
    const tagSet = Object.entries(tags || {}).map(([Key, Value]) => ({
      Key,
      Value: String(Value),
    }));

    await s3.send(
      new PutObjectTaggingCommand({
        Bucket: bucket,
        Key: key,
        Tagging: { TagSet: tagSet },
      }),
    );

    return Response.json({
      success: true,
      message: "Tags updated successfully",
    });
  } catch (error) {
    console.error("Update tags error:", error);
    return Response.json(
      { error: error.message || "Failed to update tags" },
      { status: 500 },
    );
  }
}
