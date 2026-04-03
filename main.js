const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');

const MD_FILTERS = [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }];
const SAVE_FILTERS = [{ name: 'Markdown', extensions: ['md'] }];
const VALID_SIDES = new Set(['left', 'right']);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'MDDIFF – Markdown Diff Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  buildMenu();
}

function sendFile(side, filePath, content) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('file-opened', { side, filePath, content });
}

function isValidSide(side) {
  return VALID_SIDES.has(side);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function showOperationError(title, error) {
  console.error(`[${title}]`, error);
  dialog.showErrorBox(title, errorMessage(error));
}

function buildMenu() {
  const template = [
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Zwei Dateien öffnen…',
          accelerator: 'CmdOrCtrl+O',
          click: () => openTwoFiles()
        },
        { type: 'separator' },
        {
          label: 'Linke Datei öffnen…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => openFile('left')
        },
        {
          label: 'Rechte Datei öffnen…',
          accelerator: 'CmdOrCtrl+Alt+O',
          click: () => openFile('right')
        },
        { type: 'separator' },
        {
          label: 'Linke Datei speichern',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('save-file', 'left')
        },
        {
          label: 'Rechte Datei speichern',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('save-file', 'right')
        },
        { type: 'separator' },
        { role: 'quit', label: 'Beenden' }
      ]
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { role: 'undo', label: 'Rückgängig' },
        { role: 'redo', label: 'Wiederherstellen' },
        { type: 'separator' },
        { role: 'cut', label: 'Ausschneiden' },
        { role: 'copy', label: 'Kopieren' },
        { role: 'paste', label: 'Einfügen' },
        { role: 'selectAll', label: 'Alles auswählen' }
      ]
    },
    {
      label: 'Ansicht',
      submenu: [
        { role: 'reload', label: 'Neu laden' },
        { role: 'toggleDevTools', label: 'Entwicklertools' },
        { type: 'separator' },
        { role: 'zoomIn', label: 'Vergrößern' },
        { role: 'zoomOut', label: 'Verkleinern' },
        { role: 'resetZoom', label: 'Zoom zurücksetzen' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbild' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function openFile(side) {
  if (!isValidSide(side)) {
    return { success: false, error: 'Ungültige Seite.' };
  }

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: `Markdown-Datei öffnen (${side === 'left' ? 'Links' : 'Rechts'})`,
      filters: MD_FILTERS,
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    sendFile(side, filePath, content);
    return { success: true, filePath };
  } catch (error) {
    showOperationError('Datei konnte nicht geöffnet werden', error);
    return { success: false, error: errorMessage(error) };
  }
}

async function openTwoFiles() {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Zwei Markdown-Dateien zum Vergleichen auswählen',
      filters: MD_FILTERS,
      properties: ['openFile', 'multiSelections']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const paths = result.filePaths.slice(0, 2);
    const sides = ['left', 'right'];
    await Promise.all(paths.map(async (p, i) => {
      const content = await fs.readFile(p, 'utf-8');
      sendFile(sides[i], p, content);
    }));
    return { success: true, count: paths.length };
  } catch (error) {
    showOperationError('Dateien konnten nicht geöffnet werden', error);
    return { success: false, error: errorMessage(error) };
  }
}

ipcMain.handle('open-file', (_event, side) => openFile(side));
ipcMain.handle('open-two-files', () => openTwoFiles());

async function saveToPath(filePath, content) {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true, filePath };
  } catch (error) {
    showOperationError('Datei konnte nicht gespeichert werden', error);
    return { success: false, error: errorMessage(error) };
  }
}

async function saveWithDialog(content) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Markdown-Datei speichern',
    filters: SAVE_FILTERS,
  });
  if (!result.canceled && result.filePath) return saveToPath(result.filePath, content);
  return { success: false };
}

ipcMain.handle('save-file', async (_event, payload = {}) => {
  const { filePath, content = '' } = payload;
  return filePath ? saveToPath(filePath, content) : saveWithDialog(content);
});

ipcMain.handle('save-file-as', async (_event, payload = {}) => saveWithDialog(payload.content || ''));

ipcMain.handle('read-file', async (_event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch { return { success: false }; }
});

const historyFile = path.join(app.getPath('userData'), 'compare-history.json');

ipcMain.handle('load-history', async () => {
  try {
    const data = await fs.readFile(historyFile, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
});

ipcMain.handle('save-history', async (_event, history) => {
  try {
    const safeHistory = Array.isArray(history) ? history : [];
    await fs.writeFile(historyFile, JSON.stringify(safeHistory), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('[save-history]', error);
    return { success: false, error: errorMessage(error) };
  }
});

app.whenReady().then(createWindow).catch((error) => {
  console.error('[app.whenReady]', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
