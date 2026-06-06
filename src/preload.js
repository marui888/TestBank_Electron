import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronPdf', {
  getRecentFiles: () => ipcRenderer.invoke('pdf:getRecentFiles'),
  openPdf: () => ipcRenderer.invoke('pdf:openDialog'),
  openRecentPdf: (pdfPath) => ipcRenderer.invoke('pdf:openRecent', pdfPath),
  savePdfJson: (pdfPath, data) => ipcRenderer.invoke('pdf:saveJson', pdfPath, data),
  saveMetaJson: (pdfPath, data) => ipcRenderer.invoke('pdf:saveMetaJson', pdfPath, data),
  saveQuestionSearch: (data) => ipcRenderer.invoke('questionSearch:save', data),
  openQuestionSearch: () => ipcRenderer.invoke('questionSearch:open'),
  selectTypstImage: () => ipcRenderer.invoke('typst:selectImage'),
  convertTypstImage: (payload) => ipcRenderer.invoke('typst:convertImage', payload),
  selectOutputPictureDir: (defaultPath) =>
    ipcRenderer.invoke('outputPicture:selectDir', defaultPath),
  saveOutputPicture: (fileName, pngDataUrl, outputDir) =>
    ipcRenderer.invoke('outputPicture:save', fileName, pngDataUrl, outputDir),
  confirmCloseDirty: () => ipcRenderer.invoke('pdf:confirmCloseDirty'),
});
