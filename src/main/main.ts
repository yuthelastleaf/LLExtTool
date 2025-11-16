import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { setupIpcHandlers } from './ipc-handlers';

// 按照 LLAlpcEditor 模式：在模块顶层设置 DLL 路径
const dllDir = path.join(app.getAppPath(), 'build', 'Release');
if (process.platform === 'win32') {
  // 添加 DLL 目录到 PATH
  process.env.PATH = `${dllDir};${process.env.PATH}`;
  
  // 使用 addDllDirectory (Node.js 15.0.0+)
  if (typeof (process as any).addDllDirectory === 'function') {
    try {
      (process as any).addDllDirectory(dllDir);
    } catch (e) {
      // ignore
    }
  }
}

let mainWindow: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: 'LLExtTool - 视频字幕提取工具',
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 始终打开开发者工具以便调试
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 注释掉 GPU 禁用，因为 Whisper 需要 CUDA GPU 支持
// app.disableHardwareAcceleration();
// app.commandLine.appendSwitch('disable-gpu');
// app.commandLine.appendSwitch('disable-software-rasterizer');

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
