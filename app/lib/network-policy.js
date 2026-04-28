const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isPrivateIpv4(hostname) {
  return (
    /^10\./.test(hostname) ||
    /^127\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function isLocalHttpAllowed(hostname) {
  return (
    LOCAL_HOSTNAMES.has(hostname) ||
    isPrivateIpv4(hostname) ||
    process.env.NODE_ENV !== "production" ||
    process.env.DOCKYARD_ALLOW_INSECURE_LOCAL_URLS === "1"
  );
}

export function validateOutboundUrl(input) {
  if (!input || typeof input !== "string") {
    return { ok: false, error: "url is required" };
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: "url must be a valid absolute URL" };
  }

  if (parsed.protocol === "https:") {
    return { ok: true, url: parsed.toString() };
  }

  if (parsed.protocol === "http:" && isLocalHttpAllowed(parsed.hostname)) {
    return { ok: true, url: parsed.toString(), warning: "Using insecure local HTTP webhook URL" };
  }

  return {
    ok: false,
    error: "Only https URLs are allowed. Local http URLs are allowed only for localhost or private network development targets.",
  };
}