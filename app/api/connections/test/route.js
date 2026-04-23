import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

function buildClientConfig(input) {
  const credentials = {
    accessKeyId: input.accessKeyId || "test",
    secretAccessKey: input.secretAccessKey || "test",
  };

  if (input.sessionToken) {
    credentials.sessionToken = input.sessionToken;
  }

  const config = {
    region: input.region || "us-east-1",
    credentials,
    forcePathStyle:
      input.provider === "localstack" ? true : Boolean(input.forcePathStyle),
  };

  if (input.provider !== "aws" && input.endpoint) {
    config.endpoint = input.endpoint;
  }

  return config;
}

function describeFailure(error) {
  const code = error?.name || error?.Code || "UnknownError";
  const message = error?.message || "Connection test failed";

  if (
    code === "InvalidAccessKeyId" ||
    code === "SignatureDoesNotMatch" ||
    code === "InvalidToken" ||
    code === "ExpiredToken"
  ) {
    return { ok: false, message: `Credentials invalid: ${message}` };
  }

  if (code === "NetworkingError" || code === "TimeoutError") {
    return { ok: false, message: `Endpoint unreachable: ${message}` };
  }

  if (code === "AccessDenied") {
    return {
      ok: true,
      warning: true,
      message:
        "Connected, but permission is limited (AccessDenied on ListBuckets).",
    };
  }

  return { ok: false, message: `${code}: ${message}` };
}

export async function POST(req) {
  try {
    const payload = await req.json();

    if (
      !payload?.provider ||
      !payload?.region ||
      !payload?.accessKeyId ||
      !payload?.secretAccessKey
    ) {
      return Response.json(
        {
          ok: false,
          message:
            "provider, region, accessKeyId and secretAccessKey are required",
        },
        { status: 400 },
      );
    }

    if (payload.provider !== "aws" && !payload.endpoint) {
      return Response.json(
        {
          ok: false,
          message: "endpoint is required for LocalStack connections",
        },
        { status: 400 },
      );
    }

    const client = new S3Client(buildClientConfig(payload));
    await client.send(new ListBucketsCommand({}));

    return Response.json({ ok: true, message: "Connection successful." });
  } catch (error) {
    const result = describeFailure(error);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }
}
