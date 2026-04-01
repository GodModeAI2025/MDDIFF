const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFile: (side) => ipcRenderer.invoke('open-file', side),
  openTwoFiles: () => ipcRenderer.invoke('open-two-files'),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  saveFileAs: (data) => ipcRenderer.invoke('save-file-as', data),
  onFileOpened: (callback) => ipcRenderer.on('file-opened', (_e, data) => callback(data)),
  onSaveFile: (callback) => ipcRenderer.on('save-file', (_e, side) => callback(side)),
  loadHistory: () => ipcRenderer.invoke('load-history'),
  saveHistory: (history) => ipcRenderer.invoke('save-history', history),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
});
