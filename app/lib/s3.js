import { S3Client } from "@aws-sdk/client-s3";
import { getActiveConnection } from "@/app/lib/connections-store";

export async function getS3Client() {
  const connection = await getActiveConnection();

  if (!connection) {
    throw new Error("No active connection configured");
  }

  const credentials = {
    accessKeyId: connection.accessKeyId || "test",
    secretAccessKey: connection.secretAccessKey || "test",
  };

  // Add session token if provided (for temporary AWS credentials)
  if (connection.sessionToken) {
    credentials.sessionToken = connection.sessionToken;
  }

  const clientConfig = {
    region: connection.region || "us-east-1",
    credentials,
  };

  if (connection.endpoint) {
    clientConfig.endpoint = connection.endpoint;
  }

  if (connection.provider === "localstack") {
    clientConfig.forcePathStyle = true;
  } else {
    clientConfig.forcePathStyle = Boolean(connection.forcePathStyle);
  }

  return new S3Client(clientConfig);
}
