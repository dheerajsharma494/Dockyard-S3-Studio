import { getS3Client } from "@/app/lib/s3";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export async function GET(req) {
  try {
    const s3 = await getS3Client();
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket");
    const prefix = searchParams.get("prefix") || "";
    const table = searchParams.get("table") || "s3_objects";

    if (!bucket) {
      return Response.json({ error: "bucket is required" }, { status: 400 });
    }

    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1000,
      }),
    );

    const rows = (listed.Contents || [])
      .filter((obj) => obj.Key)
      .map((obj) => ({
        key: obj.Key,
        size: obj.Size || 0,
        storageClass: obj.StorageClass || "STANDARD",
        lastModified: obj.LastModified
          ? new Date(obj.LastModified).toISOString()
          : null,
      }));

    const sqlStatements = rows.map((row) => {
      const escapedKey = row.key.replace(/'/g, "''");
      return `INSERT INTO ${table} (object_key, size_bytes, storage_class, last_modified) VALUES ('${escapedKey}', ${row.size}, '${row.storageClass}', ${row.lastModified ? `'${row.lastModified}'` : "NULL"});`;
    });

    return Response.json({
      success: true,
      count: rows.length,
      rows,
      sql: sqlStatements.join("\n"),
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to generate DB seed" },
      { status: 500 },
    );
  }
}
