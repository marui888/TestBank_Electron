import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronPdf', {
  getRecentFiles: () => ipcRenderer.invoke('pdf:getRecentFiles'),
  openPdf: () => ipcRenderer.invoke('pdf:openDialog'),
  openRecentPdf: (pdfPath) => ipcRenderer.invoke('pdf:openRecent', pdfPath),
  savePdfJson: (pdfPath, data) => ipcRenderer.invoke('pdf:saveJson', pdfPath, data),
  saveMetaJson: (pdfPath, data) => ipcRenderer.invoke('pdf:saveMetaJson', pdfPath, data),
  confirmCloseDirty: () => ipcRenderer.invoke('pdf:confirmCloseDirty'),
});
