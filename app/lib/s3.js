import { S3Client } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.AWS_S3_CUSTOM_ENDPOINT_URL,
  forcePathStyle: true,
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});
