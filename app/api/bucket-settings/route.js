import { getS3Client } from "@/app/lib/s3";
import {
  DeleteBucketPolicyCommand,
  DeleteBucketEncryptionCommand,
  GetBucketEncryptionCommand,
  GetBucketLoggingCommand,
  GetBucketPolicyCommand,
  GetPublicAccessBlockCommand,
  PutBucketEncryptionCommand,
  PutBucketLoggingCommand,
  PutBucketPolicyCommand,
  PutPublicAccessBlockCommand,
} from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  const s3 = await getS3Client();
  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get("bucket");

  if (!bucket) {
    return Response.json({ error: "bucket is required" }, { status: 400 });
  }

  const result = {
    bucket,
    policy: null,
    encryption: null,
    publicAccessBlock: null,
    logging: null,
    errors: {},
  };

  try {
    const policy = await s3.send(
      new GetBucketPolicyCommand({ Bucket: bucket }),
    );
    result.policy = policy.Policy ? JSON.parse(policy.Policy) : null;
  } catch (e) {
    result.errors.policy = e.message;
  }

  try {
    const encryption = await s3.send(
      new GetBucketEncryptionCommand({ Bucket: bucket }),
    );
    result.encryption = encryption.ServerSideEncryptionConfiguration || null;
  } catch (e) {
    result.errors.encryption = e.message;
  }

  try {
    const pab = await s3.send(
      new GetPublicAccessBlockCommand({ Bucket: bucket }),
    );
    result.publicAccessBlock = pab.PublicAccessBlockConfiguration || null;
  } catch (e) {
    result.errors.publicAccessBlock = e.message;
  }

  try {
    const logging = await s3.send(
      new GetBucketLoggingCommand({ Bucket: bucket }),
    );
    result.logging = logging.LoggingEnabled || null;
  } catch (e) {
    result.errors.logging = e.message;
  }

  return Response.json(result);
}

export async function PUT(req) {
  try {
    const s3 = await getS3Client();
    const {
      bucket,
      policy,
      publicAccessBlock,
      encryption,
      logging,
      clearPolicy,
      clearEncryption,
      clearLogging,
    } = await req.json();

    if (!bucket) {
      return Response.json({ error: "bucket is required" }, { status: 400 });
    }

    if (clearPolicy) {
      await s3.send(new DeleteBucketPolicyCommand({ Bucket: bucket }));
    } else if (policy) {
      await s3.send(
        new PutBucketPolicyCommand({
          Bucket: bucket,
          Policy: typeof policy === "string" ? policy : JSON.stringify(policy),
        }),
      );
    }

    if (clearEncryption) {
      await s3.send(new DeleteBucketEncryptionCommand({ Bucket: bucket }));
    } else if (encryption) {
      await s3.send(
        new PutBucketEncryptionCommand({
          Bucket: bucket,
          ServerSideEncryptionConfiguration: encryption,
        }),
      );
    }

    if (publicAccessBlock) {
      await s3.send(
        new PutPublicAccessBlockCommand({
          Bucket: bucket,
          PublicAccessBlockConfiguration: publicAccessBlock,
        }),
      );
    }

    if (clearLogging) {
      await s3.send(
        new PutBucketLoggingCommand({
          Bucket: bucket,
          BucketLoggingStatus: {},
        }),
      );
    } else if (logging) {
      await s3.send(
        new PutBucketLoggingCommand({
          Bucket: bucket,
          BucketLoggingStatus: { LoggingEnabled: logging },
        }),
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to update bucket settings" },
      { status: 500 },
    );
  }
}
