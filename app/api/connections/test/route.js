import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import { getConnectionById } from "@/app/lib/connections-store";

function normalizeEndpoint(endpoint) {
  const value = (endpoint || "").trim();

  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

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
    config.endpoint = normalizeEndpoint(input.endpoint);
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
    const existingConnection = payload?.id
      ? await getConnectionById(payload.id)
      : null;
    const resolvedPayload = {
      ...existingConnection,
      ...payload,
      accessKeyId:
        payload?.accessKeyId || existingConnection?.accessKeyId || "",
      secretAccessKey:
        payload?.secretAccessKey || existingConnection?.secretAccessKey || "",
      sessionToken:
        payload?.sessionToken || existingConnection?.sessionToken || "",
    };

    if (
      !resolvedPayload?.provider ||
      !resolvedPayload?.region ||
      !resolvedPayload?.accessKeyId ||
      !resolvedPayload?.secretAccessKey
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

    if (resolvedPayload.provider !== "aws" && !resolvedPayload.endpoint) {
      return Response.json(
        {
          ok: false,
          message: "endpoint is required for non-AWS providers",
        },
        { status: 400 },
      );
    }

    const client = new S3Client(buildClientConfig(resolvedPayload));
    await client.send(new ListBucketsCommand({}));

    return Response.json({ ok: true, message: "Connection successful." });
  } catch (error) {
    const result = describeFailure(error);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }
}
