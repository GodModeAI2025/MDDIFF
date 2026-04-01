const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

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
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    mainWindow.webContents.send('file-opened', { side, filePath, content });
  }
}

async function openTwoFiles() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Zwei Markdown-Dateien zum Vergleichen auswählen',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }],
    properties: ['openFile', 'multiSelections']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const paths = result.filePaths.slice(0, 2);
    const leftContent = fs.readFileSync(paths[0], 'utf-8');
    mainWindow.webContents.send('file-opened', { side: 'left', filePath: paths[0], content: leftContent });

    if (paths.length >= 2) {
      const rightContent = fs.readFileSync(paths[1], 'utf-8');
      mainWindow.webContents.send('file-opened', { side: 'right', filePath: paths[1], content: rightContent });
    }
  }
}

ipcMain.handle('open-file', async (_event, side) => {
  await openFile(side);
});

ipcMain.handle('save-file', async (_event, { filePath, content }) => {
  if (filePath) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, filePath };
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Markdown-Datei speichern',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (!result.canceled) {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, filePath: result.filePath };
  }
  return { success: false };
});

ipcMain.handle('save-file-as', async (_event, { content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Markdown-Datei speichern unter…',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (!result.canceled) {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, filePath: result.filePath };
  }
  return { success: false };
});

ipcMain.handle('read-file', (_event, filePath) => {
  try {
    return { success: true, content: fs.readFileSync(filePath, 'utf-8') };
  } catch { return { success: false }; }
});

const historyFile = path.join(app.getPath('userData'), 'compare-history.json');

ipcMain.handle('load-history', () => {
  try {
    return JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
  } catch { return []; }
});

ipcMain.handle('save-history', (_event, history) => {
  fs.writeFileSync(historyFile, JSON.stringify(history), 'utf-8');
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
