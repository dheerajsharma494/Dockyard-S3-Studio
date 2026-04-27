import { getS3Client } from "@/app/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];
const VIDEO_TYPES = [
  "video/webm",
  "video/mp4",
  "video/ogg",
  "video/quicktime",
  "video/x-msvideo",
];
const TEXT_TYPES = [
  "text/plain",
  "text/csv",
  "text/json",
  "application/json",
  "text/html",
  "text/xml",
];
const EXCEL_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const DOCUMENT_TYPES = {
  "application/msword": "Word Document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "Word Document",
  "application/vnd.ms-powerpoint": "PowerPoint Presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "PowerPoint Presentation",
  "application/zip": "ZIP Archive",
  "application/x-7z-compressed": "7z Archive",
  "application/x-rar-compressed": "RAR Archive",
};

export async function GET(req) {
  const s3 = await getS3Client();
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket");
  const key = searchParams.get("key");
  const maxSize = 50 * 1024 * 1024; // 50MB limit for buffered previews

  try {
    const data = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const contentType = data.ContentType || "application/octet-stream";
    const isImage = IMAGE_TYPES.some((type) => contentType.includes(type));
    const isVideo = VIDEO_TYPES.some((type) => contentType.includes(type));
    const isPDF =
      contentType.includes("application/pdf") || key.match(/\.pdf$/i);
    const isExcel =
      EXCEL_TYPES.some((type) => contentType.includes(type)) ||
      key.match(/\.(xlsx|xls)$/i);
    const isText =
      TEXT_TYPES.some((type) => contentType.includes(type)) ||
      key.match(/\.(txt|log|md|csv|json|xml|html)$/i);
    const documentType = DOCUMENT_TYPES[contentType] || null;

    // Stream large videos directly instead of buffering.
    if (isVideo) {
      const streamUrl = `/api/download?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}&inline=1&contentType=${encodeURIComponent(contentType)}`;
      return Response.json({
        key,
        contentLength: data.ContentLength,
        contentType,
        type: "video",
        streamUrl,
        lastModified: data.LastModified,
      });
    }

    // Check content length for formats that are buffered in memory.
    if (isPDF && data.ContentLength > maxSize) {
      const streamUrl = `/api/download?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}&inline=1&contentType=${encodeURIComponent("application/pdf")}`;
      return Response.json({
        key,
        contentLength: data.ContentLength,
        contentType,
        type: "pdf",
        streamUrl,
        lastModified: data.LastModified,
      });
    }

    if (data.ContentLength > maxSize) {
      return Response.json(
        {
          error: "File too large for preview",
          contentLength: data.ContentLength,
          maxSize: maxSize,
        },
        { status: 413 },
      );
    }

    // Convert Body to bytes
    const buffer = await data.Body.transformToByteArray();

    const isPdfSignature =
      buffer.length >= 5 &&
      Buffer.from(buffer.slice(0, 5)).toString("ascii") === "%PDF-";

    if (isPDF || isPdfSignature) {
      const base64 = Buffer.from(buffer).toString("base64");
      const dataUrl = `data:application/pdf;base64,${base64}`;
      return Response.json({
        key,
        contentLength: data.ContentLength,
        contentType: "application/pdf",
        type: "pdf",
        pdfUrl: dataUrl,
        lastModified: data.LastModified,
      });
    }

    // Handle image files
    if (isImage) {
      const base64 = Buffer.from(buffer).toString("base64");
      const dataUrl = `data:${contentType};base64,${base64}`;
      return Response.json({
        key: key,
        contentLength: data.ContentLength,
        contentType: contentType,
        type: "image",
        imageUrl: dataUrl,
        lastModified: data.LastModified,
      });
    }

    // Handle Excel files
    if (isExcel) {
      const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });
      const sheets = {};
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        sheets[sheetName] = rows;
      }
      return Response.json({
        key,
        contentLength: data.ContentLength,
        contentType,
        type: "excel",
        sheets,
        sheetNames: workbook.SheetNames,
        lastModified: data.LastModified,
      });
    }

    // Handle text files
    if (isText || !contentType.includes("application")) {
      try {
        const content = new TextDecoder().decode(buffer);
        // Check if decoding was likely successful (no null bytes)
        if (!content.includes("\x00")) {
          return Response.json({
            key: key,
            contentLength: data.ContentLength,
            contentType: contentType,
            type: "text",
            content: content,
            lastModified: data.LastModified,
          });
        }
      } catch (e) {
        // Fall through to error
      }
    }

    // Known document type
    if (documentType) {
      return Response.json(
        {
          error: `${documentType} preview is not supported. Download the file to view it.`,
          fileType: documentType,
          contentLength: data.ContentLength,
          type: "unsupported",
        },
        { status: 415 },
      );
    }

    // Default: binary file error
    return Response.json(
      {
        error: "Binary file - cannot preview",
        contentLength: data.ContentLength,
      },
      { status: 415 },
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to preview file" },
      { status: 500 },
    );
  }
}
