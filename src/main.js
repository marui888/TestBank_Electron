import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';

if (started) {
  app.quit();
}

let mainWindow;

const recentFilesName = 'recent-files.json';

function getRecentFilesPath() {
  return path.join(app.getPath('userData'), recentFilesName);
}

function getPdfJsonPath(pdfPath) {
  return pdfPath.replace(/\.pdf$/i, '.pdfJson');
}

async function readRecentFiles() {
  try {
    const text = await fs.readFile(getRecentFilesPath(), 'utf8');
    const files = JSON.parse(text);
    return Array.isArray(files) ? files.filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function writeRecentFiles(files) {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(
    getRecentFilesPath(),
    JSON.stringify(files.slice(0, 10), null, 2),
    'utf8',
  );
}

async function rememberRecentFile(pdfPath) {
  const oldFiles = await readRecentFiles();
  const nextFiles = [
    pdfPath,
    ...oldFiles.filter((filePath) => filePath !== pdfPath),
  ].slice(0, 10);

  await writeRecentFiles(nextFiles);
  return nextFiles;
}

async function readPdfJson(pdfPath) {
  const jsonPath = getPdfJsonPath(pdfPath);

  try {
    const text = await fs.readFile(jsonPath, 'utf8');
    return {
      jsonPath,
      data: JSON.parse(text),
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        jsonPath,
        data: null,
      };
    }

    throw error;
  }
}

async function openPdfByPath(pdfPath) {
  const pdfBuffer = await fs.readFile(pdfPath);
  const jsonResult = await readPdfJson(pdfPath);
  const recentFiles = await rememberRecentFile(pdfPath);

  return {
    pdfPath,
    pdfName: path.basename(pdfPath),
    pdfData: pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength,
    ),
    pdfJsonPath: jsonResult.jsonPath,
    pdfJson: jsonResult.data,
    recentFiles,
  };
}

function registerIpcHandlers() {
  ipcMain.handle('pdf:getRecentFiles', async () => readRecentFiles());

  ipcMain.handle('pdf:openDialog', async () => {
    const recentFiles = await readRecentFiles();
    const defaultPath = recentFiles[0] ? path.dirname(recentFiles[0]) : undefined;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open PDF',
      defaultPath,
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true, recentFiles };
    }

    return {
      canceled: false,
      ...(await openPdfByPath(result.filePaths[0])),
    };
  });

  ipcMain.handle('pdf:openRecent', async (_event, pdfPath) => {
    return openPdfByPath(pdfPath);
  });

  ipcMain.handle('pdf:saveJson', async (_event, pdfPath, data) => {
    const jsonPath = getPdfJsonPath(pdfPath);
    const nextData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(jsonPath, JSON.stringify(nextData, null, 2), 'utf8');

    return {
      jsonPath,
      savedAt: nextData.updatedAt,
    };
  });

  ipcMain.handle('pdf:confirmCloseDirty', async () => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Save and close', "Don't save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved changes',
      message: 'The current PDF has unsaved data.',
      detail: 'Do you want to save the .pdfJson file before closing?',
    });

    if (result.response === 0) return 'save';
    if (result.response === 1) return 'discard';
    return 'cancel';
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

app.whenReady().then(async () => {
  createWindow();
  registerIpcHandlers();

  const reactDevToolsPath = path.join(
    'C:/Users/Admin/AppData/Local/Google/Chrome/User Data/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi/7.0.1_0'
  );

  try {
    const extension = await session.defaultSession.extensions.loadExtension(
      reactDevToolsPath,
      {
        allowFileAccess: true,
      },
    );

    console.log('React DevTools loaded:', extension.name);
  } catch (error) {
    console.error('React DevTools load failed:', error);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
