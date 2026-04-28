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

function installAuthorizedFetchPatch() {
  const scope =
    typeof globalThis !== "undefined"
      ? globalThis
      : typeof window !== "undefined"
        ? window
        : null;

  if (!scope || typeof scope.fetch !== "function") {
    return false;
  }

  if (scope.fetch.__dockyardApiPatched) {
    return true;
  }

  const nativeFetch = scope.fetch.bind(scope);

  const patchedFetch = (resource, options = {}) => {
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

  patchedFetch.__dockyardApiPatched = true;
  scope.fetch = patchedFetch;

  if (typeof window !== "undefined") {
    window.fetch = patchedFetch;
  }

  return true;
}

if (
  apiToken &&
  typeof window !== "undefined"
) {
  if (!installAuthorizedFetchPatch()) {
    // Retry briefly because fetch availability timing can differ by Electron version.
    let attempts = 0;
    const maxAttempts = 20;
    const retryPatch = () => {
      if (installAuthorizedFetchPatch()) {
        return;
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        console.warn("[preload] Failed to patch fetch for API authorization");
        return;
      }

      setTimeout(retryPatch, 50);
    };

    retryPatch();
  }
}

contextBridge.exposeInMainWorld("dockyardDesktop", {
  isDesktop: true,
});
