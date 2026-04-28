const { contextBridge } = require("electron");

function getApiToken() {
  const tokenArg = process.argv.find((value) =>
    value.startsWith("--dockyard-api-token="),
  );

  return tokenArg ? tokenArg.slice("--dockyard-api-token=".length) : "";
}

function shouldAuthorizeRequest(resource) {
  try {
    const input =
      typeof resource === "string"
        ? resource
        : resource instanceof URL
          ? resource.toString()
          : resource?.url || "";
    const target = new URL(input, window.location.origin);
    return (
      target.origin === window.location.origin &&
      target.pathname.startsWith("/api/")
    );
  } catch {
    return false;
  }
}

const apiToken = getApiToken();

if (
  apiToken &&
  typeof window !== "undefined" &&
  typeof window.fetch === "function"
) {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (resource, options = {}) => {
    if (!shouldAuthorizeRequest(resource)) {
      return nativeFetch(resource, options);
    }

    const request = resource instanceof Request ? resource : null;
    const headers = new Headers(
      options.headers || request?.headers || undefined,
    );

    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${apiToken}`);
    }

    if (request) {
      return nativeFetch(
        new Request(request, {
          ...options,
          headers,
        }),
      );
    }

    return nativeFetch(resource, {
      ...options,
      headers,
    });
  };
}

contextBridge.exposeInMainWorld("dockyardDesktop", {
  isDesktop: true,
});
