const { app, BrowserWindow, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { randomBytes } = require("crypto");
const http = require("http");
const fs = require("fs");
const path = require("path");
const next = require("next");

const DEV_URL = process.env.ELECTRON_START_URL || "http://localhost:3000";
const PROD_PORT = Number(process.env.ELECTRON_PORT || 3123);
const RELEASES_URL =
  "https://github.com/dheerajsharma494/Dockyard-S3-Studio/releases/latest";

let nextServer = null;
let nextServerApp = null;
let nextServerLogTail = [];
let updaterInitialized = false;
const apiSessionToken = randomBytes(32).toString("hex");

process.env.DOCKYARD_API_TOKEN = apiSessionToken;

function isAllowedExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "https:" || parsed.protocol === "mailto:";
  } catch {
    return false;
  }
}

function isAuthorizedApiRequest(req) {
  const authHeader = req.headers.authorization || "";
  const hostHeader = String(req.headers.host || "").toLowerCase();
  const originHeader = req.headers.origin;
  const fetchSiteHeader = String(
    req.headers["sec-fetch-site"] || "",
  ).toLowerCase();
  const expectedAuth = `Bearer ${apiSessionToken}`;
  const allowedHosts = new Set([
    `127.0.0.1:${PROD_PORT}`,
    `localhost:${PROD_PORT}`,
    `[::1]:${PROD_PORT}`,
  ]);

  if (authHeader !== expectedAuth) {
    return { ok: false, status: 401, error: "Missing or invalid API token" };
  }

  if (!allowedHosts.has(hostHeader)) {
    return { ok: false, status: 403, error: "Unexpected host header" };
  }

  if (originHeader) {
    try {
      const origin = new URL(originHeader);
      const allowedOrigin =
        (origin.protocol === "http:" || origin.protocol === "https:") &&
        allowedHosts.has(origin.host.toLowerCase());

      if (!allowedOrigin) {
        return { ok: false, status: 403, error: "Unexpected origin" };
      }
    } catch {
      return { ok: false, status: 403, error: "Malformed origin" };
    }
  }

  if (
    fetchSiteHeader &&
    fetchSiteHeader !== "same-origin" &&
    fetchSiteHeader !== "none"
  ) {
    return { ok: false, status: 403, error: "Unexpected fetch site" };
  }

  return { ok: true };
}

async function showManualUpdateDialog(mainWindow, version, reason) {
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "Update requires manual download",
      message: `Version ${version || "(latest)"} is available, but automatic install is unavailable on this build.`,
      detail:
        reason ||
        "Please download and install the latest build from the Releases page.",
      buttons: ["Open Downloads Page", "Later"],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      shell.openExternal(RELEASES_URL);
    }
  } catch (error) {
    console.error("[updater] Failed to show manual update dialog", error);
  }
}

function setupAutoUpdater(mainWindow) {
  if (!app.isPackaged || updaterInitialized) return;
  updaterInitialized = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("[updater] Checking for updates");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("[updater] Update available", info.version);
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Update available",
        message: `Version ${info.version} is available. Downloading in the background...`,
      })
      .catch((error) => {
        console.warn("[updater] Failed to show update-available dialog", error);
      });
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[updater] App is up to date");
  });

  autoUpdater.on("error", (error) => {
    console.error("[updater] Update error", error);

    const message = String(error?.message || error || "");
    if (
      process.platform === "darwin" &&
      /notar|code signature|signature|gatekeeper|spctl|damaged|cannot be opened/i.test(
        message,
      )
    ) {
      showManualUpdateDialog(
        mainWindow,
        null,
        "macOS blocked automatic update install for this build. Download the latest app from Releases.",
      );
    }
  });

  autoUpdater.on("update-downloaded", async (info) => {
    console.log("[updater] Update downloaded", info.version);

    try {
      if (process.platform === "darwin") {
        const result = await dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "Update downloaded",
          message: `Version ${info.version} has been downloaded.`,
          detail:
            "If automatic install is blocked on your Mac, use 'Download manually' to install the latest build.",
          buttons: ["Restart now", "Download manually", "Later"],
          defaultId: 0,
          cancelId: 2,
        });

        if (result.response === 1) {
          shell.openExternal(RELEASES_URL);
          return;
        }

        if (result.response === 0) {
          try {
            autoUpdater.quitAndInstall(false, true);
          } catch (error) {
            console.error("[updater] Failed to install update", error);
            await showManualUpdateDialog(
              mainWindow,
              info.version,
              "Automatic install failed on this macOS build. Please install manually from Releases.",
            );
          }
        }

        return;
      }

      const result = await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Update ready",
        message: `Version ${info.version} has been downloaded. Restart now to install it?`,
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
      });

      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    } catch (error) {
      console.error("[updater] Failed to show update-downloaded dialog", error);
    }
  });

  const checkForUpdates = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.error("[updater] Failed to check for updates", error);
    });
  };

  // Run one check shortly after startup, then periodically every 4 hours.
  setTimeout(checkForUpdates, 12000);
  setInterval(checkForUpdates, 4 * 60 * 60 * 1000);
}

function pushServerLog(line) {
  if (!line) return;
  nextServerLogTail.push(line);
  if (nextServerLogTail.length > 40) {
    nextServerLogTail = nextServerLogTail.slice(-40);
  }
}

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(probe, 350);
      });
    };

    probe();
  });
}

async function startBundledNextServer() {
  if (nextServer && nextServer.listening) return;

  nextServerLogTail = [];

  const appPath = app.getAppPath();
  if (!fs.existsSync(path.join(appPath, ".next"))) {
    throw new Error(`Missing Next.js build output in ${appPath}/.next`);
  }

  nextServerApp = next({
    dev: false,
    dir: appPath,
    conf: {
      distDir: ".next",
    },
  });

  await nextServerApp.prepare();
  const requestHandler = nextServerApp.getRequestHandler();

  nextServer = http.createServer((req, res) => {
    if (req.url?.startsWith("/api/")) {
      const authorization = isAuthorizedApiRequest(req);

      if (!authorization.ok) {
        res.writeHead(authorization.status, {
          "Content-Type": "application/json",
        });
        res.end(JSON.stringify({ error: authorization.error }));
        return;
      }
    }

    requestHandler(req, res);
  });

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      pushServerLog(`[next] ${error.message}`);
      reject(error);
    };

    nextServer.once("error", onError);
    nextServer.listen(PROD_PORT, "127.0.0.1", () => {
      nextServer.removeListener("error", onError);
      resolve();
    });
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: "#0b1320",
    title: "Dockyard S3 Studio",
    autoHideMenuBar: true,
    webPreferences: {
      additionalArguments: [`--dockyard-api-token=${apiSessionToken}`],
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url === mainWindow.webContents.getURL()) {
      return;
    }

    event.preventDefault();
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url);
    }
  });

  return mainWindow;
}

async function showStartupError(mainWindow, error) {
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = message.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] || char;
  });

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Dockyard S3 Studio</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #0b1320;
            color: #e7ecf3;
            font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .card {
            width: min(680px, 92vw);
            border: 1px solid #2b3b57;
            border-radius: 12px;
            padding: 20px;
            background: #111c2f;
            box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
          }
          h1 {
            margin: 0 0 12px;
            font-size: 18px;
          }
          p {
            margin: 0 0 12px;
            color: #b8c7dd;
          }
          code {
            white-space: pre-wrap;
            word-break: break-word;
            display: block;
            background: #0b1320;
            border: 1px solid #2b3b57;
            border-radius: 8px;
            padding: 10px;
            color: #ffdddd;
          }
        </style>
      </head>
      <body>
        <main class="card">
          <h1>Dockyard S3 Studio failed to start</h1>
          <p>The embedded web server did not start. Reopen the app after closing conflicting local servers, or reinstall the app.</p>
          <code>${safeMessage}</code>
        </main>
      </body>
    </html>
  `;

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  await mainWindow.loadURL(dataUrl);
  dialog.showErrorBox("Dockyard S3 Studio startup failed", message);
}

async function bootstrapMainWindow() {
  const mainWindow = createWindow();
  const urlToLoad = app.isPackaged ? `http://localhost:${PROD_PORT}` : DEV_URL;

  try {
    if (app.isPackaged) {
      await startBundledNextServer();
      await waitForServer(urlToLoad);
    }

    await mainWindow.loadURL(urlToLoad);

    setupAutoUpdater(mainWindow);
  } catch (error) {
    console.error("Failed to bootstrap window", error);
    await showStartupError(mainWindow, error);
  }
}

app.whenReady().then(async () => {
  await bootstrapMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void bootstrapMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (nextServer) {
    nextServer.close();
    nextServer = null;
    nextServerApp = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
