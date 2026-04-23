import { getS3Client } from "@/app/lib/s3";
import { emitWebhook } from "@/app/lib/webhooks";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectTaggingCommand,
} from "@aws-sdk/client-s3";

function normalizePrefix(prefix = "") {
  if (!prefix) return "";
  // Strip any leading slashes to avoid phantom root folders
  const stripped = prefix.replace(/^\/+/, "");
  if (!stripped) return "";
  return stripped.endsWith("/") ? stripped : `${stripped}/`;
}

function buildCopyName(key, n) {
  const slash = key.lastIndexOf("/");
  const dir = slash >= 0 ? key.slice(0, slash + 1) : "";
  const filename = slash >= 0 ? key.slice(slash + 1) : key;
  const dot = filename.lastIndexOf(".");
  const base = dot >= 0 ? filename.slice(0, dot) : filename;
  const ext = dot >= 0 ? filename.slice(dot) : "";
  return `${dir}${base} (${n})${ext}`;
}

async function uniqueCopyKey(s3, bucket, sourceKey, destinationKey) {
  // If same location, find a unique numbered name
  if (sourceKey !== destinationKey) return destinationKey;
  const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
  let n = 1;
  while (n < 1000) {
    const candidate = buildCopyName(sourceKey, n);
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: candidate }));
      n++; // exists, try next
    } catch {
      return candidate; // doesn't exist, use it
    }
  }
  return buildCopyName(sourceKey, Date.now());
}

async function expandSelectionToObjectKeys(s3, bucket, key) {
  if (!key.endsWith("/")) {
    return [key];
  }

  const keys = [];
  let continuationToken;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: key,
        ContinuationToken: continuationToken,
      }),
    );

    const pageKeys = (page.Contents || [])
      .map((item) => item.Key)
      .filter(
        (itemKey) => itemKey && itemKey !== key && !itemKey.endsWith("/"),
      );
    keys.push(...pageKeys);

    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
}

export async function POST(req) {
  try {
    const s3 = await getS3Client();
    const { bucket, operation, keys, destinationPrefix, tags } =
      await req.json();
    const normalizedDestinationPrefix = normalizePrefix(
      destinationPrefix || "",
    );

    if (!bucket || !operation || !Array.isArray(keys) || keys.length === 0) {
      return Response.json(
        { error: "bucket, operation and non-empty keys are required" },
        { status: 400 },
      );
    }

    const results = [];

    for (const key of keys) {
      try {
        const sourceKeys = await expandSelectionToObjectKeys(s3, bucket, key);

        if (sourceKeys.length === 0) {
          results.push({
            key,
            success: true,
            skipped: true,
            message: "No files found",
          });
          continue;
        }

        if (operation === "delete") {
          for (const sourceKey of sourceKeys) {
            await s3.send(
              new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }),
            );
            results.push({ key: sourceKey, success: true });
          }
          continue;
        }

        if (operation === "copy") {
          for (const sourceKey of sourceKeys) {
            const relativePath = key.endsWith("/")
              ? sourceKey.slice(key.length)
              : sourceKey.split("/").pop();
            const rawDestinationKey = `${normalizedDestinationPrefix}${relativePath}`;
            const destinationKey = await uniqueCopyKey(
              s3,
              bucket,
              sourceKey,
              rawDestinationKey,
            );

            await s3.send(
              new CopyObjectCommand({
                Bucket: bucket,
                CopySource: encodeURIComponent(`${bucket}/${sourceKey}`),
                Key: destinationKey,
                MetadataDirective: "COPY",
                TaggingDirective: "COPY",
              }),
            );
            results.push({ key: sourceKey, success: true, destinationKey });
          }
          continue;
        }

        if (operation === "move") {
          for (const sourceKey of sourceKeys) {
            const relativePath = key.endsWith("/")
              ? sourceKey.slice(key.length)
              : sourceKey.split("/").pop();
            const destinationKey = `${normalizedDestinationPrefix}${relativePath}`;

            await s3.send(
              new CopyObjectCommand({
                Bucket: bucket,
                CopySource: encodeURIComponent(`${bucket}/${sourceKey}`),
                Key: destinationKey,
                MetadataDirective: "COPY",
                TaggingDirective: "COPY",
              }),
            );
            await s3.send(
              new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }),
            );
            results.push({ key: sourceKey, success: true, destinationKey });
          }
          continue;
        }

        if (operation === "tag") {
          const tagSet = Object.entries(tags || {}).map(([Key, Value]) => ({
            Key,
            Value: String(Value),
          }));

          for (const sourceKey of sourceKeys) {
            await s3.send(
              new PutObjectTaggingCommand({
                Bucket: bucket,
                Key: sourceKey,
                Tagging: { TagSet: tagSet },
              }),
            );
            results.push({ key: sourceKey, success: true });
          }
          continue;
        }

        throw new Error(`Unsupported operation: ${operation}`);
      } catch (error) {
        results.push({
          key,
          success: false,
          error: error.message || "Operation failed",
        });
      }
    }

    await emitWebhook("batch.completed", { bucket, operation, results });
    return Response.json({ success: true, operation, results });
  } catch (error) {
    return Response.json(
      { error: error.message || "Batch operation failed" },
      { status: 500 },
    );
  }
}
