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
          label: 'Linke Datei öffnen…',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFile('left')
        },
        {
          label: 'Rechte Datei öffnen…',
          accelerator: 'CmdOrCtrl+Shift+O',
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
