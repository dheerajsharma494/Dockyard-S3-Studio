import { getS3Client } from "@/app/lib/s3";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function POST(req) {
  try {
    const s3 = await getS3Client();
    const contentTypeHeader = req.headers.get("content-type") || "";

    let action;
    let bucket;
    let key;
    let contentType;
    let uploadId;
    let partNumber;
    let parts;
    let chunk;

    if (contentTypeHeader.includes("multipart/form-data")) {
      const formData = await req.formData();
      action = formData.get("action");
      bucket = formData.get("bucket");
      key = formData.get("key");
      uploadId = formData.get("uploadId");
      partNumber = formData.get("partNumber");
      chunk = formData.get("chunk");
    } else {
      const payload = await req.json();
      action = payload.action;
      bucket = payload.bucket;
      key = payload.key;
      contentType = payload.contentType;
      uploadId = payload.uploadId;
      partNumber = payload.partNumber;
      parts = payload.parts;
    }

    if (!action || !bucket || !key) {
      return Response.json(
        { error: "action, bucket, and key are required" },
        { status: 400 },
      );
    }

    if (action === "create") {
      const created = await s3.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          ContentType: contentType || "application/octet-stream",
        }),
      );
      return Response.json({ success: true, uploadId: created.UploadId, key });
    }

    if (action === "part-upload") {
      if (!uploadId || !partNumber || !chunk) {
        return Response.json(
          { error: "uploadId, partNumber, and chunk are required" },
          { status: 400 },
        );
      }

      const uploadResult = await s3.send(
        new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: Number(partNumber),
          Body: Buffer.from(await chunk.arrayBuffer()),
        }),
      );

      return Response.json({ success: true, etag: uploadResult.ETag });
    }

    if (action === "part-url") {
      if (!uploadId || !partNumber) {
        return Response.json(
          { error: "uploadId and partNumber are required" },
          { status: 400 },
        );
      }
      const url = await getSignedUrl(
        s3,
        new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: Number(partNumber),
        }),
        { expiresIn: 3600 },
      );
      return Response.json({ success: true, url });
    }

    if (action === "complete") {
      if (!uploadId || !Array.isArray(parts) || parts.length === 0) {
        return Response.json(
          { error: "uploadId and parts are required" },
          { status: 400 },
        );
      }
      const completed = await s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts
              .map((p) => ({ ETag: p.ETag, PartNumber: Number(p.PartNumber) }))
              .sort((a, b) => a.PartNumber - b.PartNumber),
          },
        }),
      );
      return Response.json({ success: true, location: completed.Location });
    }

    if (action === "abort") {
      if (!uploadId) {
        return Response.json(
          { error: "uploadId is required" },
          { status: 400 },
        );
      }
      await s3.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
        }),
      );
      return Response.json({ success: true });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error.message || "Multipart operation failed" },
      { status: 500 },
    );
  }
}
