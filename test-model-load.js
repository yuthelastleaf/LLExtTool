const path = require('path');
const bindings = require('bindings');

console.log('=== Whisper Model Load Test ===\n');

// 1. 加载模块
console.log('Step 1: Loading llwhisper module...');
let llwhisper;
try {
    llwhisper = bindings('llwhisper');
    console.log('✓ llwhisper module loaded');
    console.log('  Exports:', Object.keys(llwhisper));
} catch (error) {
    console.error('✗ Failed to load llwhisper:', error.message);
    process.exit(1);
}

// 2. 检查模型文件
const modelPath = path.join(__dirname, 'native', 'whisper.cpp', 'models', 'ggml-large-v2-f16.bin');
console.log('\nStep 2: Checking model file...');
console.log('  Path:', modelPath);

const fs = require('fs');
if (!fs.existsSync(modelPath)) {
    console.error('✗ Model file not found');
    process.exit(1);
}

const stats = fs.statSync(modelPath);
console.log(`✓ Model file exists (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

// 3. 加载模型
console.log('\nStep 3: Loading Whisper model...');
console.log('  This may take a few seconds...');

try {
    const startTime = Date.now();
    const result = llwhisper.loadModel(modelPath);
    const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result) {
        console.log(`✓ Model loaded successfully in ${loadTime}s`);
    } else {
        console.error('✗ loadModel returned false');
        process.exit(1);
    }
} catch (error) {
    console.error('✗ Failed to load model:', error.message);
    process.exit(1);
}

console.log('\n=== Test Completed Successfully ===');
console.log('\nThe Whisper model is ready for transcription!');
console.log('GPU acceleration (CUDA) will be used if available.');
