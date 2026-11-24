// SB as a Mac app: opens the HUD in a Chromium window and runs server.js itself, so no Terminal or Safari tab is needed.
// The code still lives in the project folder, so changes there apply without rebuilding the app. Keys stay in ~/Library/Application Support/SB.
const { app, BrowserWindow, shell, dialog, session, systemPreferences, globalShortcut, ipcMain } = require('electron');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), { spawn } = require('child_process');

const ROOT = process.env.SB_ROOT || path.join(os.homedir(), 'Desktop', 'Javris');
const PORT = +process.env.SB_PORT || 3000, HOME = `http://localhost:${PORT}/`;
const LOG = path.join(os.homedir(), 'Library', 'Logs', 'SB.log');
const SHORTCUT = 'Alt+Space';
let server = null, win = null, quitting = false;
// Chromium's own files go to their own folder, never into SB's private folder that holds the keys.
app.setPath('userData', process.env.SB_APPDATA || path.join(app.getPath('appData'), 'SB App'));

const own = u => { try { const x = new URL(u); return (x.hostname === 'localhost' || x.hostname === '127.0.0.1') && +x.port === PORT; } catch { return false; } };
const alive = () => new Promise(ok => {
  const r = http.get({ host: '127.0.0.1', port: PORT, path: '/api/state', timeout: 1500 }, res => { res.resume(); ok(res.statusCode === 200); });
  r.on('error', () => ok(false)); r.on('timeout', () => { r.destroy(); ok(false); });
});
// Uses a server that is already running (the browser version), otherwise starts one with Electron's own Node.
async function ensureServer() {
  if (await alive()) return;
  if (!fs.existsSync(path.join(ROOT, 'server.js'))) throw new Error(`SB-র ফোল্ডার পাইনি: ${ROOT}`);
  const log = fs.openSync(LOG, 'a');
  server = spawn(process.execPath, [path.join(ROOT, 'server.js')], { cwd: ROOT, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(PORT) }, stdio: ['ignore', log, log] });
  server.on('exit', () => { server = null; if (!quitting) setTimeout(() => ensureServer().catch(() => {}), 3000); }); // came down: start it again
  for (let i = 0; i < 60; i++) { if (await alive()) return; await new Promise(r => setTimeout(r, 250)); }
  throw new Error('SB-র server চালু হলো না। ~/Library/Logs/SB.log দেখো।');
}

// The microphone only, and only for SB's own page; the first time macOS itself asks the user.
function permissions() {
  const s = session.defaultSession;
  s.setPermissionRequestHandler(async (wc, perm, cb, d) => {
    if (perm !== 'media' || !own(d.requestingUrl || wc.getURL()) || (d.mediaTypes || []).some(t => t !== 'audio')) return cb(false);
    if (systemPreferences.getMediaAccessStatus('microphone') === 'granted') return cb(true);
    cb(await systemPreferences.askForMediaAccess('microphone'));
  });
  s.setPermissionCheckHandler((wc, perm, origin) => perm === 'media' && own(origin));
}

const APP_CSS = `.bar{-webkit-app-region:drag;padding-left:86px!important;padding-top:14px!important}.bar *{-webkit-app-region:no-drag}`;
function createWindow(hidden) {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, title: 'SB', backgroundColor: '#03050b', show: false,
    titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 16, y: 18 },
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false, preload: path.join(__dirname, 'preload.js') },
  });
  // only SB's own page lives in this window; any other link opens in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url) && !own(url)) shell.openExternal(url); return { action: own(url) ? 'allow' : 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!own(url)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.webContents.on('did-finish-load', () => win.webContents.insertCSS(APP_CSS));
  win.once('ready-to-show', () => { if (!hidden) win.show(); });
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } }); // closing hides SB, so reminders and the timer keep running
  win.loadURL(HOME);
}
function toggle() {
  if (!win) return createWindow(false);
  if (win.isVisible() && win.isFocused()) win.hide(); else { win.show(); win.focus(); }
}

ipcMain.handle('sb:login:get', e => own(e.senderFrame.url) && app.getLoginItemSettings().openAtLogin);
ipcMain.handle('sb:login:set', (e, on) => { if (!own(e.senderFrame.url)) return false; app.setLoginItemSettings({ openAtLogin: !!on }); return app.getLoginItemSettings().openAtLogin; });

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(async () => {
    permissions();
    try { await ensureServer(); } catch (e) { dialog.showErrorBox('SB', e.message); quitting = true; app.quit(); return; }
    const first = path.join(app.getPath('userData'), 'first-run-done'), atLogin = app.getLoginItemSettings().wasOpenedAtLogin;
    if (app.isPackaged && !process.env.SB_TEST && !fs.existsSync(first)) { app.setLoginItemSettings({ openAtLogin: true }); fs.writeFileSync(first, new Date().toISOString()); }
    createWindow(atLogin);
    if (!globalShortcut.register(SHORTCUT, toggle)) console.error('SB: Option+Space is taken by another app');
  });
  app.on('activate', () => { if (win) { win.show(); win.focus(); } else createWindow(false); });
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => { quitting = true; });
  // stops only the server this app started; a server started elsewhere keeps running
  app.on('will-quit', () => { globalShortcut.unregisterAll(); if (server) server.kill('SIGTERM'); });
}
