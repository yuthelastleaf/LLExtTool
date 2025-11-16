// Test script for llvideo native module
const path = require('path');

// Load the native module
const llvideo = require('./build/bin/Release/llvideo.node');

console.log('✓ llvideo module loaded successfully!');
console.log('Available functions:', Object.keys(llvideo));

// Test video file path (update this to your actual video file)
const testVideoPath = 'F:\\Downloads\\video.mp4';
const testOutputPath = 'F:\\Downloads\\audio_test.wav';

// Check if test video exists
const fs = require('fs');
if (!fs.existsSync(testVideoPath)) {
    console.log('\n⚠️  Test video not found:', testVideoPath);
    console.log('Please update testVideoPath in test-native.js to point to a valid video file');
    process.exit(0);
}

console.log('\n=== Testing Video Info ===');
try {
    const videoInfo = llvideo.getVideoInfo(testVideoPath);
    console.log('Video Info:');
    console.log('  Format:', videoInfo.format);
    console.log('  Duration:', videoInfo.duration.toFixed(2), 'seconds');
    console.log('  Resolution:', `${videoInfo.width}x${videoInfo.height}`);
    console.log('  FPS:', videoInfo.fps.toFixed(2));
    console.log('  Has Audio:', videoInfo.hasAudio);
    console.log('  Has Video:', videoInfo.hasVideo);
    if (videoInfo.hasAudio) {
        console.log('  Audio Codec:', videoInfo.audioCodec);
        console.log('  Audio Sample Rate:', videoInfo.audioSampleRate, 'Hz');
        console.log('  Audio Channels:', videoInfo.audioChannels);
    }
} catch (error) {
    console.error('❌ Error getting video info:', error.message);
}

console.log('\n=== Testing Audio Extraction ===');
try {
    console.log('Extracting audio to:', testOutputPath);
    console.log('Options: 16kHz, mono, PCM WAV');
    
    const result = llvideo.extractAudio(testVideoPath, testOutputPath, {
        sampleRate: 16000,
        channels: 1,
        codec: 'pcm_s16le',
        format: 'wav'
    });
    
    if (result) {
        console.log('✓ Audio extraction successful!');
        
        // Check output file
        if (fs.existsSync(testOutputPath)) {
            const stats = fs.statSync(testOutputPath);
            console.log(`✓ Output file created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        }
    }
} catch (error) {
    console.error('❌ Error extracting audio:', error.message);
    const lastError = llvideo.getLastError();
    if (lastError) {
        console.error('FFmpeg Error:', lastError);
    }
}

console.log('\n=== All tests completed ===');
