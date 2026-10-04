const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = '3210';
// Acquire the lock before app readiness so a second launch never starts another server.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
let serverProcess = null;
let mainWindow = null;
let quitting = false;

function appFolder() {
  // Keep the database beside the executable so the whole portable folder can be backed up/moved.
  return app.isPackaged ? path.dirname(app.getPath('exe')) : path.resolve(__dirname, '..');
}

function ensureDatabaseFolder() {
  const dataDir = path.join(appFolder(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const liveDb = path.join(dataDir, 'db.json');
  if (!fs.existsSync(liveDb)) {
    const bundledDb = path.join(process.resourcesPath, 'default-db.json');
    if (!fs.existsSync(bundledDb)) throw new Error('The default database is missing from the application package.');
    fs.copyFileSync(bundledDb, liveDb);
  }
  // Keep the session signing secret beside the database so logins survive app restarts.
  const secretFile = path.join(dataDir, '.session-secret');
  if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
  return dataDir;
}

function startServer() {
  const serverDir = path.join(process.resourcesPath, 'app-server');
  const serverFile = path.join(serverDir, 'server.js');
  if (!fs.existsSync(serverFile)) throw new Error(`Application server was not found: ${serverFile}`);
  const nodeExecutable = path.join(process.resourcesPath, 'app-node.exe');
  if (!fs.existsSync(nodeExecutable)) throw new Error(`Bundled Node.js runtime was not found: ${nodeExecutable}`);
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT,
    HOSTNAME: '127.0.0.1',
    INVENTORY_DATA_DIR: ensureDatabaseFolder(),
    SESSION_SECRET: fs.readFileSync(path.join(appFolder(), 'data', '.session-secret'), 'utf8').trim(),
    NEXT_TELEMETRY_DISABLED: '1',
  };
  const logFile = path.join(env.INVENTORY_DATA_DIR, 'server.log');
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  logStream.write(`\n[${new Date().toISOString()}] Starting local application server on port ${PORT}\n`);
  serverProcess = spawn(nodeExecutable, [serverFile], {
    cwd: serverDir,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.pipe(logStream, { end: false });
  serverProcess.stderr.pipe(logStream, { end: false });
  serverProcess.on('close', () => { try { logStream.end(); } catch (_) {} });
  serverProcess.on('error', (err) => {
    if (!quitting) dialog.showErrorBox('InventoryPro HQ could not start', err.message);
  });
  serverProcess.on('exit', (code) => {
    if (!quitting && code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox('InventoryPro HQ stopped', `The local application server stopped unexpectedly (code ${code}).`);
    }
  });
}

async function waitForServer() {
  const url = `http://127.0.0.1:${PORT}`;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (serverProcess && serverProcess.exitCode !== null) throw new Error('The local application server exited during startup.');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok || response.status < 500) return url;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('The application server did not become ready within 60 seconds.');
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f4f6fa',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Keep navigation inside the local app. about:blank is also allowed because the app
    // uses an isolated blank window for receipt/barcode/proforma printing.
    return url === 'about:blank' || url.startsWith(`http://127.0.0.1:${PORT}/`)
      ? { action: 'allow' }
      : { action: 'deny' };
  });
  const url = await waitForServer();
  await mainWindow.loadURL(url);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

if (!hasSingleInstanceLock) {
  app.quit();
} else app.whenReady().then(async () => {
  try {
    startServer();
    await createWindow();
  } catch (error) {
    dialog.showErrorBox('InventoryPro HQ startup failed', error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow().catch((e) => dialog.showErrorBox('Startup failed', String(e))); });
app.on('before-quit', () => {
  quitting = true;
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
