/**
 * Minimal test - just try to dlopen without any Electron app setup
 */

const path = require('path');
const modulePath = path.join(__dirname, 'build', 'bin', 'Release', 'llvideo.node');

console.log('Testing minimal dlopen...');
console.log('Module path:', modulePath);
console.log('Node version:', process.versions.node);
console.log('Process versions:', JSON.stringify(process.versions, null, 2));

// Add DLL directory
const dllDir = path.dirname(modulePath);
process.env.PATH = `${dllDir};${process.env.PATH}`;

if (typeof process.addDllDirectory === 'function') {
  process.addDllDirectory(dllDir);
  console.log('Added DLL directory');
}

console.log('\n--- Attempting require() ---');
try {
  const mod = require(modulePath);
  console.log('✓ SUCCESS');
  console.log('Exports:', Object.keys(mod));
} catch (error) {
  console.error('✗ FAILED:', error.message);
  console.error('Stack:', error.stack);
}
