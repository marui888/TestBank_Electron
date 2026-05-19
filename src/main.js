import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow

const createWindow = () => {
  // Create the browser window.
  // const mainWindow = new BrowserWindow({
  mainWindow = new BrowserWindow({

    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {

    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // mainWindow.loadURL('https://www.meituan.com/')

  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  //mr:: 必须先打开。
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {

  createWindow();

  const reactDevToolsPath = path.join(
    'C:/Users/Admin/AppData/Local/Google/Chrome/User Data/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi/7.0.1_0'
  );

  try {
    const extension = await session.defaultSession.extensions.loadExtension(
      // const extension = await mainWindow.webContents.session.loadExtension(
      reactDevToolsPath,
      {
        allowFileAccess: true,
      }
    );

    console.log('React DevTools loaded:', extension.name);



    // mainWindow.webContents.openDevTools();

  } catch (error) {
    console.error('React DevTools load failed:', error);
  }



  //3️⃣ 页面加载完成后再处理
  mainWindow.webContents.once('did-finish-load', () => {
    // 👉 延迟一点，确保页面和扩展都初始化完成
    setTimeout(() => {

      // 🔁 强制刷新页面（关键）
      mainWindow.webContents.reloadIgnoringCache();

      // 👉 再延迟一点再打开 DevTools
      // setTimeout(() => {
      //   mainWindow.webContents.openDevTools({ mode: 'detach' });
      // }, 1500);

    }, 2000);
  });

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  // app.on('activate', () => {
  //   if (BrowserWindow.getAllWindows().length === 0) {
  //     createWindow();
  //   }
  // });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
