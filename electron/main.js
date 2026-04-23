const { app, BrowserWindow, dialog, shell } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const next = require("next");

const DEV_URL = process.env.ELECTRON_START_URL || "http://localhost:3000";
const PROD_PORT = Number(process.env.ELECTRON_PORT || 3123);

let nextServer = null;
let nextServerApp = null;
let nextServerLogTail = [];

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
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
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
