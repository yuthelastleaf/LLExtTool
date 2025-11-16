/**
 * Test DLL loading directly using Node.js ffi-napi
 * This helps diagnose which DLL is causing the crash
 */

const path = require('path');
const fs = require('fs');

const dllDir = path.join(__dirname, 'build', 'bin', 'Release');

// Add to PATH
process.env.PATH = `${dllDir};${process.env.PATH}`;
console.log(`Added DLL dir to PATH: ${dllDir}`);

// Try addDllDirectory if available
if (typeof process.addDllDirectory === 'function') {
  try {
    process.addDllDirectory(dllDir);
    console.log('Used process.addDllDirectory()');
  } catch (e) {
    console.warn('addDllDirectory failed:', e.message);
  }
}

// List DLLs
const dlls = fs.readdirSync(dllDir).filter(f => f.endsWith('.dll'));
console.log(`\nFound ${dlls.length} DLLs:`);
dlls.forEach(dll => {
  const size = fs.statSync(path.join(dllDir, dll)).size;
  console.log(`  ${dll} (${(size / 1024 / 1024).toFixed(2)} MB)`);
});

// Try to load native module
console.log('\n--- Attempting to load llvideo.node ---');
try {
  const modulePath = path.join(dllDir, 'llvideo.node');
  console.log(`Module path: ${modulePath}`);
  
  if (!fs.existsSync(modulePath)) {
    console.error('ERROR: llvideo.node not found!');
    process.exit(1);
  }
  
  console.log('Loading module...');
  const llvideo = require(modulePath);
  
  console.log('\n✓ SUCCESS! Module loaded successfully');
  console.log('Exported functions:', Object.keys(llvideo));
  
  // Test getLastError
  const error = llvideo.getLastError();
  console.log('getLastError():', error);
  
} catch (error) {
  console.error('\n✗ FAILED to load module:');
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  console.error('Error code:', error.code);
  console.error('\nFull error:', error);
  process.exit(1);
}
