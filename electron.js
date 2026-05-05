// electron.js – Main Process
// Starts the Express/Node.js backend and then opens a BrowserWindow.
'use strict';

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── File logger ──────────────────────────────────────────────────────────────
// All console output is also written to a log file so errors are visible
// in the packaged app where a terminal is not available.
let logStream = null;
function initLog() {
  const logDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, 'app.log');
  logStream = fs.createWriteStream(logFile, { flags: 'a' });
  const stamp = () => new Date().toISOString();
  const orig = { log: console.log, error: console.error, warn: console.warn };
  console.log   = (...a) => { orig.log(...a);   logStream.write(`[${stamp()}] INFO  ${a.join(' ')}\n`); };
  console.error = (...a) => { orig.error(...a); logStream.write(`[${stamp()}] ERROR ${a.join(' ')}\n`); };
  console.warn  = (...a) => { orig.warn(...a);  logStream.write(`[${stamp()}] WARN  ${a.join(' ')}\n`); };
  console.log(`Log file: ${logFile}`);
}

// ─── Global error guards ──────────────────────────────────────────────────────
function fatalError(label, err) {
  const detail = err?.stack || err?.message || String(err);
  console.error(`[${label}]`, detail);
  dialog.showErrorBox(label, detail + `\n\nLog: ${path.join(app.getPath('userData'), 'logs', 'app.log')}`);
  app.quit();
}

process.on('uncaughtException',      (err) => fatalError('Uncaught Exception',       err));
process.on('unhandledRejection',     (err) => fatalError('Unhandled Promise Rejection', err));

// ─── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;
let httpServer = null;
let serverPort = null;

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Caspi Freight Dashboard',
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── App startup ──────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  initLog();
  console.log('App starting. appPath:', app.getAppPath());

  process.env.NODE_ENV = 'production';

  if (typeof global.DOMMatrix === 'undefined') {
    global.DOMMatrix = class DOMMatrix { constructor() {} };
  }

  process.env.DOTENV_PATH        = path.join(app.getAppPath(), 'backend', '.env');
  process.env.UPLOADS_PATH       = path.join(app.getPath('userData'), 'uploads');
  process.env.FRONTEND_DIST_PATH = path.join(app.getAppPath(), 'frontend', 'dist');

  console.log('DOTENV_PATH:',        process.env.DOTENV_PATH);
  console.log('UPLOADS_PATH:',       process.env.UPLOADS_PATH);
  console.log('FRONTEND_DIST_PATH:', process.env.FRONTEND_DIST_PATH);

  const bundlePath = path.join(__dirname, 'backend.bundle.js');
  console.log('Loading bundle:', bundlePath, '— exists:', fs.existsSync(bundlePath));

  let startServer;
  try {
    ({ startServer } = require(bundlePath));
    if (typeof startServer !== 'function') throw new Error('startServer is not exported from backend.bundle.js');
  } catch (err) {
    return fatalError('Bundle Load Error', err);
  }

  try {
    console.log('Starting backend server…');
    httpServer = await startServer();
    serverPort = httpServer.address().port;
    console.log('Backend running on port', serverPort);
  } catch (err) {
    return fatalError('Backend Startup Error', err);
  }

  createWindow(serverPort);
}).catch((err) => fatalError('App Initialization Error', err));

// ─── Cleanup ──────────────────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  if (httpServer) {
    httpServer.close(() => {
      httpServer = null;
      if (process.platform !== 'darwin') app.quit();
    });
  } else {
    if (process.platform !== 'darwin') app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null && serverPort !== null) createWindow(serverPort);
});
