const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');

const MD_FILTERS = [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }];
const SAVE_FILTERS = [{ name: 'Markdown', extensions: ['md'] }];

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
  mainWindow.webContents.send('file-opened', { side, filePath, content });
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
  const result = await dialog.showOpenDialog(mainWindow, {
    title: `Markdown-Datei öffnen (${side === 'left' ? 'Links' : 'Rechts'})`,
    filters: MD_FILTERS,
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    sendFile(side, filePath, content);
  }
}

async function openTwoFiles() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Zwei Markdown-Dateien zum Vergleichen auswählen',
    filters: MD_FILTERS,
    properties: ['openFile', 'multiSelections']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const paths = result.filePaths.slice(0, 2);
    const sides = ['left', 'right'];
    await Promise.all(paths.map(async (p, i) => {
      const content = await fs.readFile(p, 'utf-8');
      sendFile(sides[i], p, content);
    }));
  }
}

ipcMain.handle('open-file', (_event, side) => openFile(side));

async function saveToPath(filePath, content) {
  await fs.writeFile(filePath, content, 'utf-8');
  return { success: true, filePath };
}

ipcMain.handle('save-file', async (_event, { filePath, content }) => {
  if (filePath) return saveToPath(filePath, content);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Markdown-Datei speichern',
    filters: SAVE_FILTERS,
  });
  if (!result.canceled) return saveToPath(result.filePath, content);
  return { success: false };
});

ipcMain.handle('save-file-as', async (_event, { content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Markdown-Datei speichern unter…',
    filters: SAVE_FILTERS,
  });
  if (!result.canceled) return saveToPath(result.filePath, content);
  return { success: false };
});

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
    return JSON.parse(data);
  } catch { return []; }
});

ipcMain.handle('save-history', (_event, history) => {
  return fs.writeFile(historyFile, JSON.stringify(history), 'utf-8');
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
