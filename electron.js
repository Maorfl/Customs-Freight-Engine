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

  // Tell Express where the built React app lives
  process.env.FRONTEND_DIST_PATH = path.join(
    app.getAppPath(),
    'frontend',
    'dist'
  );

  try {
    // Require the compiled backend entry point
    const { startServer } = require('./backend/dist/index');
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
