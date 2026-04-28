import { promises as fs } from "fs";
import { createReadStream, createWriteStream } from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { getS3Client } from "@/app/lib/s3";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

async function walkDirectory(rootDir) {
  const files = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return files;
}

function normalizePrefix(prefix) {
  if (!prefix) return "";
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

function decodeObjectKey(key) {
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

function normalizeRelativeObjectKey(key) {
  const decodedKey = decodeObjectKey(String(key || "")).replace(/\\/g, "/");

  if (
    !decodedKey ||
    decodedKey.startsWith("/") ||
    /^[A-Za-z]:/.test(decodedKey)
  ) {
    throw new Error("Object key resolves outside the selected local folder");
  }

  const rawParts = decodedKey.split("/");
  if (
    rawParts.some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    throw new Error("Object key resolves outside the selected local folder");
  }

  const normalized = path.posix.normalize(decodedKey);
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized)
  ) {
    throw new Error("Object key resolves outside the selected local folder");
  }

  return normalized;
}

function resolveDownloadDestination(rootPath, key, normalizedPrefix) {
  const relativeKey = normalizedPrefix
    ? key.slice(normalizedPrefix.length)
    : key;
  const safeRelativeKey = normalizeRelativeObjectKey(relativeKey);
  const destination = path.resolve(
    rootPath,
    safeRelativeKey.split("/").join(path.sep),
  );

  if (
    destination !== rootPath &&
    !destination.startsWith(`${rootPath}${path.sep}`)
  ) {
    throw new Error("Object key resolves outside the selected local folder");
  }

  return {
    relativeKey: safeRelativeKey,
    destination,
  };
}

async function listAllObjects(s3, bucket, prefix) {
  const objects = [];
  let continuationToken;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    objects.push(...(page.Contents || []));
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects;
}

export async function POST(req) {
  try {
    const s3 = await getS3Client();
    const contentType = req.headers.get("content-type") || "";

    // Handle FormData (file upload from browser)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const bucket = formData.get("bucket");
      const prefix = normalizePrefix(formData.get("prefix") || "");
      const folderName = formData.get("folderName");
      const files = formData.getAll("files");

      if (!bucket || !folderName || files.length === 0) {
        return Response.json(
          { error: "bucket, folderName, and files are required" },
          { status: 400 },
        );
      }

      let uploaded = 0;

      for (const file of files) {
        if (!(file instanceof File)) continue;

        // file.webkitRelativePath contains path like "folderName/subfolder/file.txt"
        // We want to keep the structure but without the root folder name
        const pathParts = file.webkitRelativePath.split("/").slice(1); // Remove folder name
        const relativePath = pathParts.join("/");
        const key = relativePath
          ? `${prefix}${relativePath}`
          : `${prefix}${file.name}`;

        const buffer = await file.arrayBuffer();
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: Buffer.from(buffer),
          }),
        );

        uploaded++;
      }

      return Response.json({
        success: true,
        action: "upload",
        count: uploaded,
      });
    }

    // Handle JSON (server-side path from Node.js)
    const {
      action,
      bucket,
      prefix = "",
      localPath,
      dryRun = false,
    } = await req.json();

    if (!action || !bucket || !localPath) {
      return Response.json(
        { error: "action, bucket, and localPath are required" },
        { status: 400 },
      );
    }

    const resolvedLocalPath = path.resolve(localPath);
    const normalizedPrefix = normalizePrefix(prefix);

    if (action === "upload") {
      const stat = await fs.stat(resolvedLocalPath).catch(() => null);
      if (!stat || !stat.isDirectory()) {
        return Response.json(
          { error: "localPath must be an existing directory for upload" },
          { status: 400 },
        );
      }

      const localFiles = await walkDirectory(resolvedLocalPath);
      const plan = localFiles.map((filePath) => {
        const relativePath = path
          .relative(resolvedLocalPath, filePath)
          .split(path.sep)
          .join("/");
        return {
          localPath: filePath,
          key: `${normalizedPrefix}${relativePath}`,
        };
      });

      if (dryRun) {
        return Response.json({
          success: true,
          action,
          dryRun: true,
          count: plan.length,
          items: plan,
        });
      }

      const uploaded = [];

      for (const item of plan) {
        const key = item.key;

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: createReadStream(item.localPath),
          }),
        );

        uploaded.push(item);
      }

      return Response.json({
        success: true,
        action,
        count: uploaded.length,
        items: uploaded,
      });
    }

    if (action === "download") {
      const objects = await listAllObjects(s3, bucket, normalizedPrefix);
      const fileObjects = objects.filter(
        (obj) => obj.Key && !obj.Key.endsWith("/"),
      );

      const plan = fileObjects.map((obj) => {
        const { relativeKey, destination } = resolveDownloadDestination(
          resolvedLocalPath,
          obj.Key,
          normalizedPrefix,
        );
        return { key: obj.Key, relativeKey, localPath: destination };
      });

      if (dryRun) {
        return Response.json({
          success: true,
          action,
          dryRun: true,
          count: plan.length,
          items: plan,
        });
      }

      await fs.mkdir(resolvedLocalPath, { recursive: true });
      const downloaded = [];

      for (const item of plan) {
        const destination = item.localPath;
        await fs.mkdir(path.dirname(destination), { recursive: true });

        const response = await s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: item.key }),
        );
        if (!response.Body) {
          continue;
        }

        if (typeof response.Body.pipe === "function") {
          await pipeline(response.Body, createWriteStream(destination));
        } else if (typeof response.Body.transformToByteArray === "function") {
          const bytes = await response.Body.transformToByteArray();
          await fs.writeFile(destination, Buffer.from(bytes));
        } else {
          throw new Error(`Unsupported body type for key: ${item.key}`);
        }

        downloaded.push(item);
      }

      return Response.json({
        success: true,
        action,
        count: downloaded.length,
        items: downloaded,
      });
    }

    return Response.json(
      { error: "Unsupported action. Use upload or download." },
      { status: 400 },
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Local sync failed" },
      { status: 500 },
    );
  }
}
