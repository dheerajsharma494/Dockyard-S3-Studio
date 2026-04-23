import { getS3Client } from "@/app/lib/s3";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";

export const runtime = "nodejs";

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

function toRelativeArchivePath(key, basePrefix) {
  if (basePrefix && key.startsWith(basePrefix)) {
    return key.slice(basePrefix.length) || key;
  }
  return key;
}

export async function POST(req) {
  try {
    const s3 = await getS3Client();
    const { bucket, keys, basePrefix = "" } = await req.json();

    if (!bucket || !Array.isArray(keys) || keys.length === 0) {
      return Response.json(
        { error: "bucket and non-empty keys are required" },
        { status: 400 },
      );
    }

    const expanded = [];
    for (const key of keys) {
      const objectKeys = await expandSelectionToObjectKeys(s3, bucket, key);
      expanded.push(...objectKeys);
    }

    const uniqueKeys = Array.from(new Set(expanded));
    if (uniqueKeys.length === 0) {
      return Response.json(
        { error: "No files found in selected items" },
        { status: 400 },
      );
    }

    const output = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (error) => {
      output.destroy(error);
    });

    archive.pipe(output);

    for (const key of uniqueKeys) {
      const data = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );

      const entryName = toRelativeArchivePath(key, basePrefix) || key;
      const body = data.Body;

      if (body && typeof body.pipe === "function") {
        archive.append(body, { name: entryName });
        continue;
      }

      if (body && typeof body.transformToByteArray === "function") {
        const bytes = await body.transformToByteArray();
        archive.append(Buffer.from(bytes), { name: entryName });
        continue;
      }

      if (body && typeof body.arrayBuffer === "function") {
        const buffer = await body.arrayBuffer();
        archive.append(Buffer.from(buffer), { name: entryName });
        continue;
      }

      throw new Error(`Unsupported object body type for ${key}`);
    }

    archive.finalize();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `s3-download-${timestamp}.zip`;

    return new Response(Readable.toWeb(output), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to create archive" },
      { status: 500 },
    );
  }
}
