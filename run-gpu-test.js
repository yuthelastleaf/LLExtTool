const path = require('path');
const fs = require('fs');

console.log('GPU smoke test: load ggml model via llwhisper');

// Ensure DLLs are discoverable
const dllDir = path.join(__dirname, 'build', 'Release');
process.env.PATH = `${dllDir};${process.env.PATH}`;
if (typeof process.addDllDirectory === 'function') {
  try { process.addDllDirectory(dllDir); } catch (e) { /* ignore */ }
}

const bindings = require('bindings');
let llwhisper;
try {
  llwhisper = bindings('llwhisper');
} catch (err) {
  console.error('Failed to load llwhisper native module:', err.message);
  process.exit(2);
}

// Use model path from native/whisper.cpp/models by default
const modelPath = path.join(__dirname, 'native', 'whisper.cpp', 'models', 'ggml-large-v2-f16.bin');

console.log('Model path:', modelPath);
if (!fs.existsSync(modelPath)) {
  console.error('Model file not found. Please place a ggml model at the path above or update run-gpu-test.js');
  process.exit(3);
}

console.log('Calling llwhisper.loadModel(...) to initialize GPU backend if available');
const t0 = Date.now();
try {
  llwhisper.loadModel(modelPath);
  const t1 = Date.now();
  console.log(`Model loaded successfully. Time: ${(t1 - t0)/1000}s`);
  // If the addon exposes a way to query backend, print a note
  if (typeof llwhisper.getBackendInfo === 'function') {
    try {
      console.log('Backend:', llwhisper.getBackendInfo());
    } catch (e) { /* ignore */ }
  }
  process.exit(0);
} catch (err) {
  console.error('Error loading model:', err && err.message ? err.message : err);
  console.error(err && err.stack ? err.stack : '');
  process.exit(4);
}
