import { S3Client } from "@aws-sdk/client-s3";
import { getActiveConnection } from "@/app/lib/connections-store";

function resolveCredentialValue(connectionValue, envValue) {
  if (connectionValue && connectionValue !== "test") {
    return connectionValue;
  }

  if (envValue) {
    return envValue;
  }

  return connectionValue || "test";
}

export async function getS3Client() {
  const connection = await getActiveConnection();

  if (!connection) {
    throw new Error("No active connection configured");
  }

  const credentials = {
    accessKeyId: resolveCredentialValue(
      connection.accessKeyId,
      process.env.AWS_ACCESS_KEY_ID,
    ),
    secretAccessKey: resolveCredentialValue(
      connection.secretAccessKey,
      process.env.AWS_SECRET_ACCESS_KEY,
    ),
  };

  // Add session token if provided (for temporary AWS credentials)
  if (connection.sessionToken || process.env.AWS_SESSION_TOKEN) {
    credentials.sessionToken =
      connection.sessionToken || process.env.AWS_SESSION_TOKEN;
  }

  const clientConfig = {
    region: connection.region || process.env.AWS_REGION || "us-east-1",
    credentials,
  };

  if (connection.endpoint) {
    clientConfig.endpoint = connection.endpoint;
  } else if (process.env.AWS_S3_CUSTOM_ENDPOINT_URL) {
    clientConfig.endpoint = process.env.AWS_S3_CUSTOM_ENDPOINT_URL;
  }

  if (connection.provider === "localstack") {
    clientConfig.forcePathStyle = true;
  } else {
    clientConfig.forcePathStyle = Boolean(connection.forcePathStyle);
  }

  return new S3Client(clientConfig);
}
