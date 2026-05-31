import { app, BrowserView, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createDesktopShellState, registerDesktopIpc } from './ipc.js';
import { createElectronCdpToolDriver } from './tools/electron-driver.js';
import { registerDesktopToolIpc } from './tools/ipc.js';
import { createDesktopToolRegistry } from './tools/registry.js';
import { calculateDesktopLayout } from './window-layout.js';
const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rendererEntry = process.env.VITE_DEV_SERVER_URL ??
    pathToFileURL(path.join(desktopRoot, 'dist-renderer/index.html')).toString();
const shellState = createDesktopShellState({
    appUrl: process.env.GIMME_JOB_APP_URL ?? 'https://app.gimme-job.com',
    assistUrl: process.env.GIMME_JOB_ASSIST_URL ?? 'https://job-boards.greenhouse.io',
});
let assistView = null;
registerDesktopIpc(ipcMain, shellState, {
    loadAssistUrl: async (url) => {
        await assistView?.webContents.loadURL(url);
    },
});
registerDesktopToolIpc(ipcMain, createDesktopToolRegistry(createElectronCdpToolDriver({
    getWebContents: () => {
        if (!assistView) {
            throw new Error('ATS assist view is not ready.');
        }
        return assistView.webContents;
    },
})));
app
    .whenReady()
    .then(createWindow)
    .catch(error => {
    console.error('Failed to start desktop shell:', error);
    app.quit();
});
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        void createWindow();
    }
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
async function createWindow() {
    const mainWindow = new BrowserWindow({
        height: 900,
        minHeight: 720,
        minWidth: 1120,
        title: 'Gimme Job Desktop',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
        width: 1440,
    });
    const appView = new BrowserView({
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    const atsView = new BrowserView({
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    assistView = atsView;
    mainWindow.addBrowserView(appView);
    mainWindow.addBrowserView(atsView);
    mainWindow.on('resize', () => {
        layoutViews(mainWindow, appView, atsView);
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url);
        return { action: 'deny' };
    });
    layoutViews(mainWindow, appView, atsView);
    await mainWindow.loadURL(rendererEntry);
    await Promise.all([
        appView.webContents.loadURL(shellState.appUrl),
        atsView.webContents.loadURL(shellState.assistUrl),
    ]);
}
function layoutViews(mainWindow, appView, currentAssistView) {
    const [width, height] = mainWindow.getContentSize();
    const layout = calculateDesktopLayout({ height, width });
    appView.setBounds(layout.main);
    currentAssistView.setBounds(layout.assist);
    appView.setAutoResize({ height: true, width: true });
    currentAssistView.setAutoResize({ height: true, width: true });
}
