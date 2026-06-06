import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {
  convertImageToSource,
  convertLatexFragmentToTypstAll,
  convertLatexFragmentToTypstFragment,
  getOutputFormatExtension,
  getOutputFormatLabel,
  getOutputPictureDir,
  getPngBytesFromDataUrl,
  getPromptOutputFormat,
  getSafeOutputPictureDir,
  getTypstOutputDir,
  normalizeOutputFormat,
  sanitizeOutputBaseName,
  sanitizeOutputPictureFileName,
} from './main/imageMathConvertService.js';

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

function getMetaJsonPath(pdfPath) {
  return pdfPath.replace(/\.pdf$/i, '.metaJson');
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

async function readMetaJson(pdfPath) {
  const metaJsonPath = getMetaJsonPath(pdfPath);

  try {
    const text = await fs.readFile(metaJsonPath, 'utf8');

    return {
      metaJsonPath,
      data: JSON.parse(text),
      error: null,
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        metaJsonPath,
        data: null,
        error: null,
      };
    }

    return {
      metaJsonPath,
      data: null,
      error: error.message || String(error),
    };
  }
}

async function openPdfByPath(pdfPath) {
  const pdfBuffer = await fs.readFile(pdfPath);
  const jsonResult = await readPdfJson(pdfPath);
  const metaJsonResult = await readMetaJson(pdfPath);
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
    pdfMetaJsonPath: metaJsonResult.metaJsonPath,
    pdfMetaJson: metaJsonResult.data,
    pdfMetaJsonError: metaJsonResult.error,
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

  ipcMain.handle('pdf:saveMetaJson', async (_event, pdfPath, data) => {
    const metaJsonPath = getMetaJsonPath(pdfPath);
    const nextData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(metaJsonPath, JSON.stringify(nextData, null, 2), 'utf8');

    return {
      metaJsonPath,
      metadata: nextData,
      savedAt: nextData.updatedAt,
    };
  });

  ipcMain.handle('questionSearch:save', async (_event, data) => {
    const recentFiles = await readRecentFiles();
    const defaultPath = recentFiles[0]
      ? path.join(path.dirname(recentFiles[0]), 'question-search.json')
      : 'question-search.json';
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save question search',
      defaultPath,
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    const savedAt = new Date().toISOString();
    const nextData = {
      ...data,
      savedAt,
    };

    await fs.writeFile(result.filePath, JSON.stringify(nextData, null, 2), 'utf8');

    return {
      canceled: false,
      filePath: result.filePath,
      savedAt,
    };
  });

  ipcMain.handle('questionSearch:open', async () => {
    const recentFiles = await readRecentFiles();
    const defaultPath = recentFiles[0] ? path.dirname(recentFiles[0]) : undefined;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open question search',
      defaultPath,
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }

    const text = await fs.readFile(result.filePaths[0], 'utf8');

    return {
      canceled: false,
      filePath: result.filePaths[0],
      data: JSON.parse(text),
    };
  });

  ipcMain.handle('typst:selectImage', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select image for Typst conversion',
      defaultPath: getOutputPictureDir(),
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      ],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }

    return {
      canceled: false,
      imagePath: result.filePaths[0],
    };
  });

  ipcMain.handle('typst:convertImage', async (_event, payload = {}) => {
    const imagePath = payload.imagePath || '';
    const outputDir = getTypstOutputDir();
    const baseName = sanitizeOutputBaseName(path.basename(imagePath));
    const outputFormat = normalizeOutputFormat(payload.outputFormat);
    const promptOutputFormat = getPromptOutputFormat(outputFormat);
    const outputExtension = getOutputFormatExtension(outputFormat);
    const outputFormatLabel = getOutputFormatLabel(outputFormat);
    const rawPath = path.join(outputDir, `${baseName}.${outputFormat}.qwen.raw.txt`);
    const sourcePath = path.join(outputDir, `${baseName}.${outputFormat}.${outputExtension}`);
    const latexPath = path.join(outputDir, `${baseName}.latex.tex`);
    const result = await convertImageToSource({
      imagePath,
      baseUrl: payload.baseUrl,
      model: payload.model,
      client: payload.client,
      outputFormat,
    });

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(rawPath, result.rawText, 'utf8');

    let sourceCode = result.sourceCode;

    if (
      outputFormat === 'latex-to-typst-local-math-only' ||
      outputFormat === 'latex-to-typst-local-all'
    ) {
      await fs.writeFile(latexPath, result.sourceCode, 'utf8');
      sourceCode = outputFormat === 'latex-to-typst-local-all'
        ? convertLatexFragmentToTypstAll(result.sourceCode)
        : convertLatexFragmentToTypstFragment(result.sourceCode);
    }

    await fs.writeFile(sourcePath, sourceCode, 'utf8');

    return {
      outputDir,
      rawPath,
      typstPath: outputFormat === 'typst' ? sourcePath : '',
      sourcePath,
      latexPath: outputFormat === 'latex-to-typst-local-math-only' ||
        outputFormat === 'latex-to-typst-local-all'
        ? latexPath
        : '',
      rawText: result.rawText,
      typstCode: outputFormat === 'typst' ? sourceCode : '',
      sourceCode,
      modelSourceCode: result.sourceCode,
      model: payload.model,
      baseUrl: payload.baseUrl,
      clientUsed: result.clientUsed,
      outputFormat,
      outputFormatLabel,
      promptOutputFormat,
    };
  });

  ipcMain.handle('outputPicture:selectDir', async (_event, defaultPath) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select output picture folder',
      defaultPath: getSafeOutputPictureDir(defaultPath),
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }

    return {
      canceled: false,
      outputDir: result.filePaths[0],
    };
  });

  ipcMain.handle('outputPicture:save', async (_event, fileName, pngDataUrl, outputDir) => {
    const safeOutputDir = getSafeOutputPictureDir(outputDir);
    const safeFileName = sanitizeOutputPictureFileName(fileName);
    const outputPath = path.join(safeOutputDir, safeFileName);
    const pngBytes = getPngBytesFromDataUrl(pngDataUrl);

    await fs.mkdir(safeOutputDir, { recursive: true });
    await fs.writeFile(outputPath, pngBytes);

    return {
      outputDir: safeOutputDir,
      outputPath,
      fileName: safeFileName,
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

  mainWindow.maximize();

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
