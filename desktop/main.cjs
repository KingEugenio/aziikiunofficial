// Aziiki desktop shell — Electron main process.
//
// This does NOT run Aziiki's real backend (server.ts) inside the desktop
// app. That server requires secret keys (SUPABASE_SERVICE_ROLE_KEY,
// Upstash Redis credentials) to even start — shipping those inside an
// app anyone can unzip would let someone extract them and bypass every
// row-level-security rule in the database. Instead, this shell:
//
//   1. Serves the already-built static frontend (the "app" folder, a
//      copy of `npm run build`'s dist/ output) from a local server, so
//      the UI loads instantly even with no internet connection.
//   2. Transparently forwards any request to /api/* to your real,
//      already-hosted Aziiki deployment (set once in Settings) — the
//      exact same backend the web version talks to, so admin-portal
//      changes (feature flags, branding, plans...) reach this app the
//      same way they reach a browser tab, whenever it's online.
//
// No secrets ever live in this app or get shipped in an installer built
// from it — it forwards the signed-in user's own access token, same as
// any browser would, and the real backend does its own auth/authz.

const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const express = require("express");

const isMac = process.platform === "darwin";
const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");
const STATIC_DIR = path.join(__dirname, "app");
const LOCAL_PORT = 47821; // arbitrary, unlikely to collide with anything else on the machine

// Edit this one line, then rebuild the installers (see the SDLC doc), and
// every NEW install of Aziiki will already know where your server is —
// nobody has to type anything into Settings. This is plain text on
// purpose: it's the one thing meant to be edited directly in GitHub by
// someone who isn't touching any other code. It intentionally does NOT
// live in the admin portal or anywhere online-fetched, because the app
// needs to know this address before it can reach the admin portal (or
// anything else) at all - there's no way around that ordering. Leave it
// blank (the default) to keep asking each person once on first launch,
// same as today.
const DEFAULT_SERVER_URL_PATH = path.join(__dirname, "resources", "default-server-url.txt");

function readDefaultServerUrl() {
  try {
    return fs.readFileSync(DEFAULT_SERVER_URL_PATH, "utf8").trim();
  } catch {
    return "";
  }
}

let mainWindow = null;
let settingsWindow = null;
let server = null;

function readConfig() {
  try {
    const stored = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (stored.apiBaseUrl) return stored;
  } catch {
    // No local config saved on this machine yet - fall through to the
    // baked-in default below.
  }
  return { apiBaseUrl: readDefaultServerUrl() };
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

/**
 * Starts the local server this app's window actually loads. Static files
 * come from disk (instant, works offline); anything under /api is
 * forwarded to whatever URL Settings has on file. If no URL is set yet,
 * /api requests get a clear JSON error instead of hanging or crashing —
 * the frontend already handles a failed fetch gracefully (see
 * OfflineQueuedError in the web app's own src/lib/api.ts).
 */
function startLocalServer() {
  // Idempotent: on macOS the app outlives its last window, so this can be
  // called again on reopen - never start a second listener on the same port.
  if (server && server.listening) return;
  const expressApp = express();

  expressApp.use(express.raw({ type: "*/*", limit: "20mb" }));

  expressApp.use("/api", async (req, res) => {
    const { apiBaseUrl } = readConfig();
    if (!apiBaseUrl) {
      res.status(503).json({ error: "No server URL configured yet. Open Aziiki > Settings and enter your Aziiki deployment URL." });
      return;
    }

    try {
      const target = `${apiBaseUrl.replace(/\/+$/, "")}/api${req.url}`;
      const headers = { ...req.headers };
      delete headers.host;
      delete headers.connection;
      delete headers["content-length"];

      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
      });

      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        if (!["content-encoding", "transfer-encoding", "connection"].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    } catch (err) {
      res.status(502).json({ error: "Couldn't reach the Aziiki server. Check your internet connection or the server URL in Settings." });
    }
  });

  // Static frontend last, so /api never falls through to a 404 HTML page.
  expressApp.use(express.static(STATIC_DIR));
  expressApp.get("*", (req, res) => {
    res.sendFile(path.join(STATIC_DIR, "index.html"));
  });

  server = expressApp.listen(LOCAL_PORT, "127.0.0.1");
  server.on("error", (err) => {
    // Port already taken by something else - without this the window just
    // loaded nothing and stayed blank white with no explanation.
    dialog.showErrorBox(
      "Aziiki couldn't start",
      `Aziiki needs port ${LOCAL_PORT} on this computer but it's already in use (${err.code || err.message}). Close the other program using it, or restart your computer, then open Aziiki again.`
    );
    app.quit();
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Aziiki",
    icon: path.join(__dirname, "resources", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${LOCAL_PORT}`);

  // If the page ever fails to load (server not up yet, or it went away),
  // don't leave a blank white window: make sure the server is running and
  // retry a couple of times, then show a readable message with a Retry link.
  let retries = 0;
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return; // -3 = aborted (normal during reloads)
    startLocalServer();
    if (retries < 3) {
      retries += 1;
      setTimeout(() => mainWindow && mainWindow.loadURL(`http://127.0.0.1:${LOCAL_PORT}`), 600 * retries);
      return;
    }
    const html = `<html><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#f8fafc;color:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="max-width:420px;text-align:center"><h2>Aziiki couldn't load</h2><p style="color:#475569">${String(errorDescription).replace(/</g, "&lt;")}</p><a href="http://127.0.0.1:${LOCAL_PORT}" style="display:inline-block;margin-top:12px;padding:10px 18px;background:#059669;color:white;border-radius:10px;text-decoration:none;font-weight:600">Try again</a></div></body></html>`;
    mainWindow && mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 360,
    resizable: false,
    title: "Aziiki Settings",
    parent: mainWindow ?? undefined,
    modal: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, "settings.html"));
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

ipcMain.handle("aziiki:get-config", () => readConfig());
ipcMain.handle("aziiki:set-config", (_event, config) => {
  writeConfig(config);
  if (mainWindow) mainWindow.loadURL(`http://127.0.0.1:${LOCAL_PORT}`);
  return true;
});

function buildMenu() {
  const template = [
    ...(isMac
      ? [
          {
            label: "Aziiki",
            submenu: [
              { label: "Settings...", click: () => createSettingsWindow() },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [...(isMac ? [] : [{ label: "Settings...", click: () => createSettingsWindow() }, { type: "separator" }]), { role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }],
    },
    {
      label: "View",
      submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About Aziiki",
          click: () => shell.openExternal("https://github.com/KingEugenio/aziikiunofficial"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Only one Aziiki at a time - a second launch would fight the first over the
// local port (and its saved login), which also showed up as a blank window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else if (app.isReady()) {
      startLocalServer();
      createMainWindow();
    }
  });

  app.whenReady().then(() => {
    startLocalServer();
    buildMenu();
    createMainWindow();

    const { apiBaseUrl } = readConfig();
    if (!apiBaseUrl) {
      createSettingsWindow();
    }

    app.on("activate", () => {
      // macOS keeps the app alive after the last window closes; clicking the
      // Dock icon lands here. The server must be running BEFORE the window
      // loads it - it used to be closed on window-all-closed, so this opened
      // a window pointing at a dead server (the blank white screen).
      startLocalServer();
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    // Deliberately do NOT close the server here: on macOS the app stays
    // running and will be reopened from the Dock. It's closed on real quit.
    if (!isMac) app.quit();
  });

  app.on("before-quit", () => {
    if (server) server.close();
  });
}
