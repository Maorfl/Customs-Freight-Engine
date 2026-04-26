// electron.js – Main Process
// Starts the Express/Node.js backend and then opens a BrowserWindow.
'use strict';

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

let mainWindow = null;
let httpServer = null;
let serverPort = null;

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,   // keep renderer process sandboxed
      contextIsolation: true,
    },
    title: 'Caspi Freight Dashboard',
    show: false, // shown after the page finishes loading
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Mark as production so Express serves the React static build
  process.env.NODE_ENV = 'production';

  // pdfjs-dist (used by pdf-parse) references DOMMatrix at module init time.
  // It is never actually called during text extraction, so a minimal stub is
  // enough to prevent the "DOMMatrix is not defined" crash in Node.js.
  if (typeof global.DOMMatrix === 'undefined') {
    global.DOMMatrix = class DOMMatrix {
      constructor() {}
    };
  }

  // Tell the backend bundle where its resource folders live.
  // UPLOADS_PATH goes to the OS user-data directory so it is always writable,
  // even in a packaged Electron app where the app bundle is read-only.
  process.env.DOTENV_PATH = path.join(app.getAppPath(), 'backend', '.env');
  process.env.UPLOADS_PATH = path.join(app.getPath('userData'), 'uploads');
  process.env.FRONTEND_DIST_PATH = path.join(app.getAppPath(), 'frontend', 'dist');

  try {
    // Require the single-file esbuild bundle (all backend deps inlined)
    const { startServer } = require('./backend.bundle');
    httpServer = await startServer();
    serverPort = httpServer.address().port;
    createWindow(serverPort);
  } catch (err) {
    console.error('Failed to start backend server:', err);
    dialog.showErrorBox(
      'Startup Error',
      `Failed to start the application server:\n\n${err.message}`
    );
    app.quit();
  }
});

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

// macOS: re-create window when dock icon is clicked and no windows are open
app.on('activate', () => {
  if (mainWindow === null && serverPort !== null) {
    createWindow(serverPort);
  }
});
