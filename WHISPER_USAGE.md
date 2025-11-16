# Whisper CLI-like Integration

This project provides a Native Node.js module that wraps Whisper.cpp with FFmpeg, offering functionality similar to `whisper-cli.exe` but with full JavaScript/TypeScript integration.

## Features

✅ **FFmpeg Audio Extraction** - Extract audio from videos with custom parameters  
✅ **Whisper.cpp Integration** - Full Whisper speech recognition support  
✅ **CLI-like Parameters** - Support for all major whisper-cli options  
✅ **Multiple Export Formats** - TXT, SRT, VTT, JSON, LRC output formats  
✅ **Large Model Support** - Works with any Whisper model (tiny to large-v3)  
✅ **TypeScript Definitions** - Full type safety and IDE autocomplete  

## Quick Start

### 1. Build the Native Modules

```bash
npm run build:native
```

### 2. Prepare a Whisper Model

**Option A: Download a small model for testing**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\download-model.ps1 -ModelSize tiny
```

**Option B: Use your existing model**
- Update the `modelPath` in `test-whisper-cli.js` to point to your model
- Example: `F:\ollama\model\whisper-large-v2-gglm\ggml-large-v2-f16.bin`

### 3. Run the Test

```bash
node test-whisper-cli.js
```

## Usage Examples

### Simple Transcription

```javascript
const llwhisper = require('./build/bin/Release/llwhisper.node');

// Load model
llwhisper.loadModel('models/whisper/ggml-tiny.bin');

// Transcribe with simple language parameter
const segments = llwhisper.transcribe('audio.wav', 'en');

// Print results
segments.forEach(seg => {
    console.log(`[${seg.startTime}s - ${seg.endTime}s] ${seg.text}`);
});
```

### Advanced Transcription (CLI-equivalent)

Equivalent to this whisper-cli command:
```bash
whisper-cli.exe -m model.bin -f audio.wav -l ja -pp --suppress-nst -et 2.8 -lpt -0.5 -osrt -otxt
```

JavaScript equivalent:
```javascript
const segments = llwhisper.transcribe('audio.wav', {
    language: 'ja',                 // -l ja
    entropy_thold: 2.8,             // -et 2.8
    logprob_thold: -0.5,            // -lpt -0.5
    suppress_nst: true,             // --suppress-nst
    print_progress: true,           // -pp
    n_threads: 8,
    print_timestamps: true
});
```

### Export to Different Formats

```javascript
// Export to SRT subtitles (-osrt)
const srt = llwhisper.exportToSrt(segments);
fs.writeFileSync('output.srt', srt);

// Export to plain text (-otxt)
const txt = llwhisper.exportToTxt(segments);
fs.writeFileSync('output.txt', txt);

// Export to VTT
const vtt = llwhisper.exportToVtt(segments);
fs.writeFileSync('output.vtt', vtt);

// Export to JSON
const json = llwhisper.exportToJson(segments);
fs.writeFileSync('output.json', json);

// Export to LRC lyrics
const lrc = llwhisper.exportToLrc(segments);
fs.writeFileSync('output.lrc', lrc);
```

### Video to Transcription Pipeline

```javascript
const llvideo = require('./build/bin/Release/llvideo.node');
const llwhisper = require('./build/bin/Release/llwhisper.node');

// Step 1: Extract audio from video
llvideo.extractAudio('video.mp4', 'audio.wav', {
    sampleRate: 16000,    // Whisper requires 16kHz
    channels: 1,          // Mono
    codec: 'pcm_s16le',
    format: 'wav'
});

// Step 2: Load Whisper model
llwhisper.loadModel('models/whisper/ggml-base.bin');

// Step 3: Transcribe
const segments = llwhisper.transcribe('audio.wav', {
    language: 'auto',
    n_threads: 8
});

// Step 4: Export to SRT
const srt = llwhisper.exportToSrt(segments);
fs.writeFileSync('subtitles.srt', srt);
```

## Whisper Parameters Reference

All parameters supported (matching whisper-cli):

| Parameter | Type | Default | Description | CLI Equivalent |
|-----------|------|---------|-------------|----------------|
| `language` | string | 'auto' | Language code (en, zh, ja, etc.) | `-l` |
| `translate` | boolean | false | Translate to English | `--translate` |
| `n_threads` | number | 4 | Number of threads | `-t` |
| `offset_ms` | number | 0 | Start offset in milliseconds | `-ot` |
| `duration_ms` | number | 0 | Duration to process (0=all) | `-d` |
| `entropy_thold` | number | 2.4 | Entropy threshold | `-et` |
| `logprob_thold` | number | -1.0 | Log probability threshold | `-lpt` |
| `temperature` | number | 0.0 | Sampling temperature | `--temperature` |
| `suppress_nst` | boolean | false | Suppress non-speech tokens | `--suppress-nst` |
| `best_of` | number | 5 | Number of best candidates | `--best-of` |
| `beam_size` | number | -1 | Beam search size | `--beam-size` |
| `print_timestamps` | boolean | true | Print timestamps | `--print-timestamps` |
| `print_progress` | boolean | false | Print progress | `-pp` |

## Supported Model Formats

Any Whisper GGML model:
- **tiny** (~75 MB) - Fast, lower accuracy
- **base** (~142 MB) - Balanced
- **small** (~466 MB) - Good accuracy
- **medium** (~1.5 GB) - Better accuracy
- **large-v1/v2/v3** (~3 GB) - Best accuracy

## Output Formats

All standard whisper-cli output formats:

- **TXT** (`-otxt`) - Plain text transcription
- **SRT** (`-osrt`) - SubRip subtitles
- **VTT** (`-ovtt`) - WebVTT subtitles
- **JSON** - Structured data with timestamps
- **LRC** - Lyrics format for music players

## TypeScript Support

Full TypeScript definitions included:

```typescript
import { loadModel, transcribe, WhisperParams, TranscriptSegment } from './build/bin/Release/llwhisper.node';

const params: WhisperParams = {
    language: 'ja',
    entropy_thold: 2.8,
    logprob_thold: -0.5,
    suppress_nst: true
};

const segments: TranscriptSegment[] = transcribe('audio.wav', params);
```

## Performance Tips

1. **Use appropriate model size** - tiny/base for real-time, large for accuracy
2. **Adjust threads** - Set `n_threads` to your CPU core count
3. **Process chunks** - Use `duration_ms` for long audio files
4. **GPU support** - Whisper.cpp was built with GPU support if available

## Troubleshooting

### Model not found
```
❌ Model not found: models/whisper/ggml-tiny.bin
```
Download a model or update the path.

### Audio format errors
Whisper requires 16kHz mono audio. Use FFmpeg extraction:
```javascript
llvideo.extractAudio(input, output, {
    sampleRate: 16000,
    channels: 1
});
```

### Out of memory
Use a smaller model (tiny/base) or process audio in chunks with `duration_ms`.

## API Reference

See `native/llwhisper.d.ts` for complete TypeScript definitions and documentation.

## Comparison with whisper-cli

| Feature | whisper-cli | This Library |
|---------|-------------|--------------|
| Language support | ✅ | ✅ |
| All output formats | ✅ | ✅ |
| Advanced parameters | ✅ | ✅ |
| JavaScript integration | ❌ | ✅ |
| FFmpeg integration | ❌ | ✅ |
| TypeScript support | ❌ | ✅ |
| Programmatic control | Limited | Full |

## License

MIT
