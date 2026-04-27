import { getS3Client } from "@/app/lib/s3";
import { HeadObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );

    return Response.json({
      contentType: response.ContentType || "application/octet-stream",
      cacheControl: response.CacheControl || "",
      contentDisposition: response.ContentDisposition || "",
      contentEncoding: response.ContentEncoding || "",
      metadata: response.Metadata || {},
      storageClass: response.StorageClass || "STANDARD",
      size: response.ContentLength,
      lastModified: response.LastModified,
    });
  } catch (error) {
    console.error("Get metadata error:", error);
    return Response.json(
      { error: error.message || "Failed to get metadata" },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  try {
    const {
      bucket,
      key,
      contentType,
      cacheControl,
      contentDisposition,
      contentEncoding,
      customMetadata,
    } = await request.json();

    if (!bucket || !key) {
      return Response.json({ error: "Missing bucket or key" }, { status: 400 });
    }

    const s3 = await getS3Client();

    // Copy object with updated metadata
    const params = {
      Bucket: bucket,
      CopySource: `${bucket}/${key}`,
      Key: key,
      ContentType: contentType || "application/octet-stream",
      MetadataDirective: "REPLACE",
    };

    if (cacheControl) params.CacheControl = cacheControl;
    if (contentDisposition) params.ContentDisposition = contentDisposition;
    if (contentEncoding) params.ContentEncoding = contentEncoding;
    if (customMetadata && Object.keys(customMetadata).length > 0) {
      params.Metadata = customMetadata;
    }

    await s3.send(new CopyObjectCommand(params));

    return Response.json({
      success: true,
      message: "Metadata updated successfully",
    });
  } catch (error) {
    console.error("Update metadata error:", error);
    return Response.json(
      { error: error.message || "Failed to update metadata" },
      { status: 500 },
    );
  }
}
