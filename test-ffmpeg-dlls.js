/**
 * Test loading FFmpeg DLLs directly in Electron
 */

const { app } = require('electron');
const path = require('path');
const ffi = require('ffi-napi');

app.disableHardwareAcceleration();

app.whenReady().then(() => {
  console.log('\n=== Testing FFmpeg DLL Loading ===');
  console.log('Electron version:', process.versions.electron);
  console.log('Node version:', process.versions.node);
  
  const dllDir = path.join(__dirname, 'build', 'bin', 'Release');
  process.env.PATH = `${dllDir};${process.env.PATH}`;
  
  if (typeof process.addDllDirectory === 'function') {
    process.addDllDirectory(dllDir);
    console.log('Added DLL directory:', dllDir);
  }
  
  try {
    console.log('\n--- Testing avutil-59.dll ---');
    const avutil = ffi.Library(path.join(dllDir, 'avutil-59.dll'), {});
    console.log('✓ avutil loaded');
    
    console.log('\n--- Testing swresample-5.dll ---');
    const swresample = ffi.Library(path.join(dllDir, 'swresample-5.dll'), {});
    console.log('✓ swresample loaded');
    
    console.log('\n--- Testing avcodec-61.dll ---');
    const avcodec = ffi.Library(path.join(dllDir, 'avcodec-61.dll'), {});
    console.log('✓ avcodec loaded');
    
    console.log('\n--- Testing avformat-61.dll ---');
    const avformat = ffi.Library(path.join(dllDir, 'avformat-61.dll'), {});
    console.log('✓ avformat loaded');
    
    console.log('\n✓ All FFmpeg DLLs loaded successfully!');
    
  } catch (error) {
    console.error('\n✗ Failed to load FFmpeg DLL');
    console.error('Error:', error.message);
  }
  
  setTimeout(() => app.quit(), 2000);
});

app.on('window-all-closed', () => app.quit());
