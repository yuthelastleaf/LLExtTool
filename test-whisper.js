const path = require('path');

// Load native modules
const llvideo = require('./build/bin/Release/llvideo.node');
const llwhisper = require('./build/bin/Release/llwhisper.node');

console.log('\n🎬 FFmpeg + Whisper Integration Test\n');
console.log('=' .repeat(60));

// Test video file
const videoPath = 'F:\\Downloads\\video.mp4';
const audioPath = 'F:\\Downloads\\audio_whisper.wav';
const modelPath = 'models/whisper/ggml-tiny.bin';

console.log('\n📹 Step 1: Extract Audio from Video');
console.log('-'.repeat(60));

try {
    // Check if video file exists
    const fs = require('fs');
    if (!fs.existsSync(videoPath)) {
        console.error(`❌ Video file not found: ${videoPath}`);
        process.exit(1);
    }
    
    // Get video info
    console.log('\nVideo file:', videoPath);
    const videoInfo = llvideo.getVideoInfo(videoPath);
    console.log('Video info:', {
        duration: `${videoInfo.duration.toFixed(2)}s`,
        resolution: `${videoInfo.width}x${videoInfo.height}`,
        fps: videoInfo.fps,
        audioCodec: videoInfo.audioCodec,
        audioSampleRate: videoInfo.audioSampleRate
    });
    
    // Extract first 30 seconds for testing
    console.log('\n🎵 Extracting audio (first 30 seconds for testing)...');
    const options = {
        sampleRate: 16000,      // Whisper requires 16kHz
        channels: 1,            // Mono
        codec: 'pcm_s16le',     // 16-bit PCM
        format: 'wav',
        startTime: 0,
        duration: 30            // Only first 30 seconds
    };
    
    llvideo.extractAudio(videoPath, audioPath, options);
    
    const audioStats = fs.statSync(audioPath);
    console.log(`✓ Audio extracted: ${(audioStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Output: ${audioPath}`);
    
} catch (error) {
    console.error('❌ Audio extraction failed:', error.message);
    process.exit(1);
}

console.log('\n🎤 Step 2: Transcribe Audio with Whisper');
console.log('-'.repeat(60));

try {
    const fs = require('fs');
    
    // Check if model exists
    if (!fs.existsSync(modelPath)) {
        console.error(`❌ Whisper model not found: ${modelPath}`);
        console.log('\n💡 Download the model with:');
        console.log('   powershell -ExecutionPolicy Bypass -File scripts\\download-model.ps1 -ModelSize tiny');
        process.exit(1);
    }
    
    console.log('\nModel:', modelPath);
    console.log('Loading model...');
    llwhisper.loadModel(modelPath);
    console.log('✓ Model loaded successfully');
    
    console.log('\nTranscribing audio...');
    console.log('(This may take a while depending on audio length)');
    
    const startTime = Date.now();
    const segments = llwhisper.transcribe(audioPath, 'auto');
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n✓ Transcription completed in ${elapsed}s`);
    console.log(`  Found ${segments.length} segments`);
    
    console.log('\n📝 Transcription Result:');
    console.log('='.repeat(60));
    
    if (segments.length === 0) {
        console.log('(No speech detected)');
    } else {
        segments.forEach((seg, i) => {
            const start = seg.startTime.toFixed(2);
            const end = seg.endTime.toFixed(2);
            console.log(`\n[${start}s - ${end}s]`);
            console.log(seg.text);
        });
        
        console.log('\n' + '='.repeat(60));
        console.log('\n📄 Full Text:');
        const fullText = segments.map(s => s.text).join(' ');
        console.log(fullText);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed!\n');
    
} catch (error) {
    console.error('❌ Transcription failed:', error.message);
    process.exit(1);
}
