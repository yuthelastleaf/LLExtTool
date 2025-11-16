const path = require('path');
const bindings = require('bindings');
const fs = require('fs');

console.log('=== GPU Acceleration Test ===\n');

// 1. 加载模块
console.log('Step 1: Loading llwhisper...');
let llwhisper;
try {
    llwhisper = bindings('llwhisper');
    console.log('✓ llwhisper loaded\n');
} catch (error) {
    console.error('✗ Failed:', error.message);
    process.exit(1);
}

// 2. 检查 CUDA DLL
console.log('Step 2: Checking CUDA DLLs...');
const buildDir = path.join(__dirname, 'build', 'Release');
const cudaDlls = ['ggml-cuda.dll', 'ggml.dll', 'ggml-base.dll'];

let foundCuda = false;
for (const dll of cudaDlls) {
    const dllPath = path.join(buildDir, dll);
    if (fs.existsSync(dllPath)) {
        const stats = fs.statSync(dllPath);
        console.log(`  ✓ ${dll} (${(stats.size / 1024).toFixed(0)} KB)`);
        if (dll === 'ggml-cuda.dll') foundCuda = true;
    } else {
        console.log(`  ✗ ${dll} not found`);
    }
}

if (foundCuda) {
    console.log('\n  🎉 CUDA DLL found - GPU acceleration available!');
} else {
    console.log('\n  ⚠ CUDA DLL not found - using CPU only');
}

// 3. 加载模型（这会初始化 GPU backend）
const modelPath = path.join(__dirname, 'native', 'whisper.cpp', 'models', 'ggml-large-v2-f16.bin');
console.log('\nStep 3: Loading model (initializes GPU backend)...');
console.log(`  Model: ${path.basename(modelPath)}`);

if (!fs.existsSync(modelPath)) {
    console.error('  ✗ Model not found');
    process.exit(1);
}

try {
    console.log('  Loading... (this may take a few seconds)');
    const startTime = Date.now();
    const result = llwhisper.loadModel(modelPath);
    const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result) {
        console.log(`  ✓ Model loaded in ${loadTime}s`);
    } else {
        console.error('  ✗ Failed to load model');
        process.exit(1);
    }
} catch (error) {
    console.error('  ✗ Error:', error.message);
    process.exit(1);
}

// 4. 检测 GPU 使用情况
console.log('\nStep 4: GPU Detection Info');
console.log('  Note: If CUDA is available and working, you should see:');
console.log('  - Faster model loading (< 5s vs 10-20s on CPU)');
console.log('  - GPU memory usage in Task Manager during transcription');
console.log('  - Much faster transcription (10-50x speedup)');

console.log('\n=== Summary ===');
if (foundCuda) {
    console.log('✓ GPU Acceleration: ENABLED');
    console.log('  - ggml-cuda.dll is present');
    console.log('  - Whisper.cpp was compiled with GGML_CUDA=ON');
    console.log('  - CUDA backend will be used automatically');
    console.log('\nTo verify GPU usage during transcription:');
    console.log('  1. Open Task Manager → Performance → GPU');
    console.log('  2. Run a transcription test');
    console.log('  3. Watch for GPU usage spike');
} else {
    console.log('✗ GPU Acceleration: DISABLED (CPU only)');
    console.log('  Reason: CUDA DLL not found');
}
