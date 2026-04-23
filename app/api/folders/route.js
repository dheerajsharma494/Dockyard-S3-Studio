import { getS3Client } from "@/app/lib/s3";
import { emitWebhook } from "@/app/lib/webhooks";
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

export async function POST(req) {
  try {
    const s3 = await getS3Client();
    const { bucket, prefix, name } = await req.json();

    if (!bucket || !name) {
      return Response.json(
        { error: "bucket and name are required" },
        { status: 400 },
      );
    }

    const basePrefix = prefix || "";
    const folderKey = `${basePrefix}${name.replace(/^\/+|\/+$/g, "")}/`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: folderKey,
        Body: "",
        ContentType: "application/x-directory",
      }),
    );

    await emitWebhook("folder.created", { bucket, folderKey });
    return Response.json({ success: true, folderKey });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to create folder" },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    const s3 = await getS3Client();
    const { bucket, prefix } = await req.json();

    if (!bucket || !prefix) {
      return Response.json(
        { error: "bucket and prefix are required" },
        { status: 400 },
      );
    }

    let continuationToken;
    let deletedCount = 0;

    do {
      const listed = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const objects = (listed.Contents || [])
        .map((obj) => ({ Key: obj.Key }))
        .filter((obj) => obj.Key);

      if (objects.length > 0) {
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: objects },
          }),
        );
        deletedCount += objects.length;
      }

      continuationToken = listed.IsTruncated
        ? listed.NextContinuationToken
        : undefined;
    } while (continuationToken);

    await emitWebhook("folder.deleted", { bucket, prefix, deletedCount });
    return Response.json({ success: true, deletedCount });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to delete folder" },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    const s3 = await getS3Client();
    const { bucket, sourcePrefix, destinationPrefix } = await req.json();

    if (!bucket || !sourcePrefix || !destinationPrefix) {
      return Response.json(
        { error: "bucket, sourcePrefix and destinationPrefix are required" },
        { status: 400 },
      );
    }

    if (sourcePrefix === destinationPrefix) {
      return Response.json(
        { error: "sourcePrefix and destinationPrefix must be different" },
        { status: 400 },
      );
    }

    const destinationProbe = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: destinationPrefix,
        MaxKeys: 1,
      }),
    );

    if ((destinationProbe.Contents || []).length > 0) {
      return Response.json(
        {
          error:
            "Destination folder already exists and contains objects. Choose a different folder name.",
        },
        { status: 409 },
      );
    }

    let continuationToken;
    let movedCount = 0;

    do {
      const listed = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: sourcePrefix,
          ContinuationToken: continuationToken,
        }),
      );

      const keys = (listed.Contents || [])
        .map((obj) => obj.Key)
        .filter((key) => key);

      if (keys.length > 0) {
        for (const key of keys) {
          const relativeKey = key.slice(sourcePrefix.length);
          const newKey = `${destinationPrefix}${relativeKey}`;
          const encodedSource = encodeURIComponent(`${bucket}/${key}`);

          await s3.send(
            new CopyObjectCommand({
              Bucket: bucket,
              CopySource: encodedSource,
              Key: newKey,
            }),
          );
        }

        await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: keys.map((key) => ({ Key: key })),
            },
          }),
        );

        movedCount += keys.length;
      }

      continuationToken = listed.IsTruncated
        ? listed.NextContinuationToken
        : undefined;
    } while (continuationToken);

    await emitWebhook("folder.moved", {
      bucket,
      sourcePrefix,
      destinationPrefix,
      movedCount,
    });

    return Response.json({
      success: true,
      sourcePrefix,
      destinationPrefix,
      movedCount,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to rename folder" },
      { status: 500 },
    );
  }
}
