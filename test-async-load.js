/**
 * Test loading native module through IPC (async)
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();

app.whenReady().then(() => {
  console.log('\n=== Async Module Load Test ===');
  
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // Don't show window
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  // Setup IPC handler
  ipcMain.handle('test-load', async () => {
    console.log('[IPC] Received test-load request');
    
    const dllDir = path.join(__dirname, 'build', 'bin', 'Release');
    process.env.PATH = `${dllDir};${process.env.PATH}`;
    
    if (typeof process.addDllDirectory === 'function') {
      process.addDllDirectory(dllDir);
      console.log('[IPC] Added DLL directory');
    }
    
    try {
      console.log('[IPC] Loading module...');
      const modulePath = path.join(dllDir, 'llvideo.node');
      const llvideo = require(modulePath);
      
      console.log('[IPC] ✓ Module loaded successfully!');
      console.log('[IPC] Exports:', Object.keys(llvideo));
      
      return { success: true, exports: Object.keys(llvideo) };
    } catch (error) {
      console.error('[IPC] ✗ Failed to load:', error.message);
      return { success: false, error: error.message };
    }
  });
  
  // Load a simple HTML that triggers IPC
  win.loadURL('data:text/html,<html><body><script>require("electron").ipcRenderer.invoke("test-load").then(r => { console.log("Result:", r); setTimeout(() => process.exit(r.success ? 0 : 1), 1000); });</script><h1>Testing...</h1></body></html>');
  
  setTimeout(() => {
    console.log('[Main] Timeout - closing');
    app.quit();
  }, 5000);
});

app.on('window-all-closed', () => {
  app.quit();
});
