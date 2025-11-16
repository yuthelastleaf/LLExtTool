/**
 * Test native module loading in Electron environment
 * Run with: npx electron test-electron-native.js
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(() => {
  console.log('\n=== Electron Native Module Test ===');
  console.log('Electron version:', process.versions.electron);
  console.log('Node version:', process.versions.node);
  console.log('Chrome version:', process.versions.chrome);
  console.log('V8 version:', process.versions.v8);
  console.log('Process type:', process.type);
  console.log('Platform:', process.platform);
  console.log('Arch:', process.arch);
  
  const dllDir = path.join(__dirname, 'build', 'bin', 'Release');
  
  // Add to PATH
  process.env.PATH = `${dllDir};${process.env.PATH}`;
  console.log(`\n[DLL] Added to PATH: ${dllDir}`);
  
  // Use addDllDirectory if available
  if (typeof process.addDllDirectory === 'function') {
    try {
      process.addDllDirectory(dllDir);
      console.log('[DLL] Used process.addDllDirectory()');
    } catch (e) {
      console.warn('[DLL] addDllDirectory failed:', e.message);
    }
  }
  
  // List DLLs
  const dlls = fs.readdirSync(dllDir).filter(f => f.endsWith('.dll'));
  console.log(`[DLL] Found ${dlls.length} DLLs:`, dlls.join(', '));
  
  // Try to load module
  console.log('\n--- Attempting to load llvideo.node ---');
  const modulePath = path.join(dllDir, 'llvideo.node');
  console.log('Module path:', modulePath);
  console.log('Module exists:', fs.existsSync(modulePath));
  
  // Setup crash handler
  process.on('uncaughtException', (error) => {
    console.error('\n!!! Uncaught Exception !!!');
    console.error('Error:', error);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('\n!!! Unhandled Rejection !!!');
    console.error('Reason:', reason);
  });
  
  try {
    console.log('Loading module...');
    console.log('Using process.dlopen...');
    
    // Try using process.dlopen directly with flags
    const module = { exports: {} };
    
    // Constants for dlopen flags (from Node.js)
    const RTLD_LAZY = 0x00001;
    const RTLD_NOW = 0x00002;
    const RTLD_GLOBAL = 0x00100;
    const RTLD_LOCAL = 0x00000;
    
    if (process.dlopen) {
      console.log('Using process.dlopen with RTLD_NOW | RTLD_GLOBAL');
      process.dlopen(module, modulePath, RTLD_NOW | RTLD_GLOBAL);
      const llvideo = module.exports;
      
      console.log('\n✓ SUCCESS! Module loaded via dlopen');
      console.log('Exported functions:', Object.keys(llvideo));
      
      // Test a function
      const error = llvideo.getLastError();
      console.log('getLastError():', error || '(empty)');
      
      console.log('\n=== Test PASSED ===');
    } else {
      console.log('process.dlopen not available, using require...');
      const llvideo = require(modulePath);
      
      console.log('\n✓ SUCCESS! Module loaded');
      console.log('Exported functions:', Object.keys(llvideo));
      
      // Test a function
      const error = llvideo.getLastError();
      console.log('getLastError():', error || '(empty)');
      
      console.log('\n=== Test PASSED ===');
    }
    
  } catch (error) {
    console.error('\n✗ FAILED to load module');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    if (error.errno) console.error('Error errno:', error.errno);
    if (error.syscall) console.error('Error syscall:', error.syscall);
    console.error('Error stack:\n', error.stack);
    console.log('\n=== Test FAILED ===');
  }
  
  // Wait a bit then exit
  setTimeout(() => {
    console.log('\nExiting...');
    app.quit();
  }, 2000);
});

app.on('window-all-closed', () => {
  app.quit();
});
