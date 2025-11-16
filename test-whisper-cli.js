const fs = require('fs');
const path = require('path');

// Load native modules
const llvideo = require('./build/bin/Release/llvideo.node');
const llwhisper = require('./build/bin/Release/llwhisper.node');

console.log('\n🎙️  Whisper CLI-like Test\n');
console.log('='.repeat(70));

// Configuration (equivalent to your whisper-cli command)
// whisper-cli.exe -m F:\ollama\model\whisper-large-v2-gglm\ggml-large-v2-f16.bin 
//                 -f audio.wav -l ja -pp --suppress-nst -et 2.8 -lpt -0.5 -osrt -otxt

const config = {
    // Model path
    modelPath: 'F:\\ollama\\model\\whisper-large-v2-gglm\\ggml-large-v2-f16.bin',
    // Or use a smaller model for testing:
    // modelPath: 'models/whisper/ggml-tiny.bin',
    
    // Input files
    videoPath: 'F:\\Downloads\\video.mp4',
    audioPath: 'F:\\Downloads\\audio_whisper.wav',
    
    // Output files
    outputDir: 'F:\\Downloads',
    outputBaseName: 'whisper_output',
    
    // Whisper parameters (matching your CLI command)
    whisperParams: {
        language: 'ja',                 // -l ja
        entropy_thold: 2.8,             // -et 2.8
        logprob_thold: -0.5,            // -lpt -0.5
        suppress_nst: true,             // --suppress-nst
        print_progress: true,           // -pp
        n_threads: 8,                   // Use 8 threads
        print_timestamps: true          // Print timestamps
    },
    
    // Output formats (matching -osrt -otxt)
    exportFormats: ['txt', 'srt', 'vtt', 'json', 'lrc']
};

async function main() {
    try {
        // Step 1: Check if model exists
        console.log('\n📦 Step 1: Loading Whisper Model');
        console.log('-'.repeat(70));
        
        if (!fs.existsSync(config.modelPath)) {
            console.error(`❌ Model not found: ${config.modelPath}`);
            console.log('\n💡 Available options:');
            console.log('   1. Download a model:');
            console.log('      powershell -ExecutionPolicy Bypass -File scripts\\download-model.ps1 -ModelSize tiny');
            console.log('   2. Or update modelPath in the config to point to your model');
            process.exit(1);
        }
        
        console.log(`Model: ${config.modelPath}`);
        console.log('Loading...');
        
        llwhisper.loadModel(config.modelPath);
        console.log('✓ Model loaded successfully\n');
        
        // Step 2: Extract audio from video (if needed)
        console.log('🎬 Step 2: Prepare Audio File');
        console.log('-'.repeat(70));
        
        if (!fs.existsSync(config.audioPath)) {
            if (!fs.existsSync(config.videoPath)) {
                console.error(`❌ Neither audio nor video file found`);
                console.log(`   Audio: ${config.audioPath}`);
                console.log(`   Video: ${config.videoPath}`);
                process.exit(1);
            }
            
            console.log('Extracting audio from video...');
            console.log(`Input: ${config.videoPath}`);
            
            // Get video info
            const videoInfo = llvideo.getVideoInfo(config.videoPath);
            console.log(`Video: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration.toFixed(1)}s`);
            
            // Extract audio (Whisper requires 16kHz mono)
            llvideo.extractAudio(config.videoPath, config.audioPath, {
                sampleRate: 16000,
                channels: 1,
                codec: 'pcm_s16le',
                format: 'wav',
                duration: 60  // Extract first 60 seconds for testing
            });
            
            const audioSize = fs.statSync(config.audioPath).size;
            console.log(`✓ Audio extracted: ${(audioSize / 1024 / 1024).toFixed(2)} MB`);
        } else {
            console.log(`✓ Using existing audio file: ${config.audioPath}`);
        }
        
        const audioSize = fs.statSync(config.audioPath).size;
        console.log(`Audio file: ${(audioSize / 1024 / 1024).toFixed(2)} MB\n`);
        
        // Step 3: Transcribe with Whisper
        console.log('🎤 Step 3: Transcribing Audio');
        console.log('-'.repeat(70));
        console.log('Parameters:');
        console.log(`  Language: ${config.whisperParams.language}`);
        console.log(`  Entropy threshold: ${config.whisperParams.entropy_thold}`);
        console.log(`  Logprob threshold: ${config.whisperParams.logprob_thold}`);
        console.log(`  Suppress non-speech: ${config.whisperParams.suppress_nst}`);
        console.log(`  Threads: ${config.whisperParams.n_threads}`);
        console.log('');
        
        const startTime = Date.now();
        console.log('Transcribing... (This may take a while)');
        
        const segments = llwhisper.transcribe(config.audioPath, config.whisperParams);
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✓ Transcription completed in ${elapsed}s`);
        console.log(`  Found ${segments.length} segments\n`);
        
        // Step 4: Display results
        console.log('📝 Step 4: Transcription Results');
        console.log('='.repeat(70));
        
        if (segments.length === 0) {
            console.log('(No speech detected)');
        } else {
            // Display first few segments
            const displayCount = Math.min(10, segments.length);
            console.log(`\nShowing first ${displayCount} segments:\n`);
            
            for (let i = 0; i < displayCount; i++) {
                const seg = segments[i];
                const start = seg.startTime.toFixed(2).padStart(7);
                const end = seg.endTime.toFixed(2).padStart(7);
                console.log(`[${start}s -> ${end}s] ${seg.text}`);
            }
            
            if (segments.length > displayCount) {
                console.log(`\n... and ${segments.length - displayCount} more segments`);
            }
            
            // Full text
            console.log('\n' + '-'.repeat(70));
            console.log('📄 Full Text:');
            console.log('-'.repeat(70));
            const fullText = segments.map(s => s.text).join(' ');
            console.log(fullText);
        }
        
        // Step 5: Export to different formats
        console.log('\n\n💾 Step 5: Exporting Results');
        console.log('='.repeat(70));
        
        const exports = {
            txt: llwhisper.exportToTxt(segments),
            srt: llwhisper.exportToSrt(segments),
            vtt: llwhisper.exportToVtt(segments),
            json: llwhisper.exportToJson(segments),
            lrc: llwhisper.exportToLrc(segments)
        };
        
        // Save exports
        for (const format of config.exportFormats) {
            const outputPath = path.join(config.outputDir, `${config.outputBaseName}.${format}`);
            fs.writeFileSync(outputPath, exports[format], 'utf8');
            const size = (fs.statSync(outputPath).size / 1024).toFixed(2);
            console.log(`✓ Saved ${format.toUpperCase()}: ${outputPath} (${size} KB)`);
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ All tasks completed successfully!\n');
        
        // Summary
        console.log('📊 Summary:');
        console.log(`   Transcription time: ${elapsed}s`);
        console.log(`   Segments: ${segments.length}`);
        console.log(`   Output formats: ${config.exportFormats.join(', ').toUpperCase()}`);
        console.log(`   Output directory: ${config.outputDir}`);
        console.log('');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main();
