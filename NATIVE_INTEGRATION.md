# C++ Native 模块集成指南

本文档详细说明如何完成 FFmpeg 和 Whisper.cpp 的 C++ 集成。

## 目录结构

```
native/
├── include/              # 头文件
│   ├── ffmpeg_wrapper.h
│   └── whisper_wrapper.h
├── src/                  # 源文件
│   ├── llvideo.cpp      # FFmpeg NAPI 绑定
│   ├── llwhisper.cpp    # Whisper NAPI 绑定
│   ├── ffmpeg_wrapper.cpp
│   └── whisper_wrapper.cpp
├── ffmpeg/              # FFmpeg 库（需下载）
│   ├── include/
│   ├── lib/
│   └── bin/
└── whisper.cpp/         # Whisper.cpp（需克隆）
```

## 第一部分：集成 FFmpeg

### 1.1 下载 FFmpeg

**Windows 平台：**

1. 访问 https://github.com/BtbN/FFmpeg-Builds/releases
2. 下载 `ffmpeg-master-latest-win64-gpl-shared.zip`
3. 解压到 `native/ffmpeg/` 目录

目录结构应为：
```
native/ffmpeg/
├── include/
│   ├── libavcodec/
│   ├── libavformat/
│   ├── libavutil/
│   └── libswresample/
├── lib/
│   ├── avcodec.lib
│   ├── avformat.lib
│   ├── avutil.lib
│   └── swresample.lib
└── bin/
    ├── avcodec-60.dll
    ├── avformat-60.dll
    ├── avutil-58.dll
    └── swresample-4.dll
```

### 1.2 完善 ffmpeg_wrapper.cpp

在 `native/src/ffmpeg_wrapper.cpp` 中添加实际的 FFmpeg 实现：

```cpp
extern "C" {
#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libavutil/avutil.h>
#include <libswresample/swresample.h>
}

// 实现音频提取
bool FFmpegWrapper::extractAudio(const std::string& videoPath, 
                                 const std::string& outputPath, 
                                 const std::string& format) {
    AVFormatContext* pFormatCtx = nullptr;
    
    // 打开输入文件
    if (avformat_open_input(&pFormatCtx, videoPath.c_str(), nullptr, nullptr) != 0) {
        return false;
    }
    
    // 获取流信息
    if (avformat_find_stream_info(pFormatCtx, nullptr) < 0) {
        avformat_close_input(&pFormatCtx);
        return false;
    }
    
    // 查找音频流
    int audioStreamIndex = -1;
    for (unsigned int i = 0; i < pFormatCtx->nb_streams; i++) {
        if (pFormatCtx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_AUDIO) {
            audioStreamIndex = i;
            break;
        }
    }
    
    if (audioStreamIndex == -1) {
        avformat_close_input(&pFormatCtx);
        return false;
    }
    
    AVCodecParameters* codecParams = pFormatCtx->streams[audioStreamIndex]->codecpar;
    
    // 查找解码器
    const AVCodec* codec = avcodec_find_decoder(codecParams->codec_id);
    if (!codec) {
        avformat_close_input(&pFormatCtx);
        return false;
    }
    
    // 创建解码器上下文
    AVCodecContext* codecCtx = avcodec_alloc_context3(codec);
    if (avcodec_parameters_to_context(codecCtx, codecParams) < 0) {
        avcodec_free_context(&codecCtx);
        avformat_close_input(&pFormatCtx);
        return false;
    }
    
    if (avcodec_open2(codecCtx, codec, nullptr) < 0) {
        avcodec_free_context(&codecCtx);
        avformat_close_input(&pFormatCtx);
        return false;
    }
    
    // 初始化重采样器（转换为 16kHz 单声道，Whisper 需要）
    SwrContext* swrCtx = swr_alloc_set_opts(
        nullptr,
        AV_CH_LAYOUT_MONO,        // 输出：单声道
        AV_SAMPLE_FMT_S16,        // 输出：16-bit PCM
        16000,                     // 输出：16kHz
        codecCtx->channel_layout,  // 输入：原始声道布局
        codecCtx->sample_fmt,      // 输入：原始采样格式
        codecCtx->sample_rate,     // 输入：原始采样率
        0, nullptr
    );
    
    if (!swrCtx || swr_init(swrCtx) < 0) {
        swr_free(&swrCtx);
        avcodec_free_context(&codecCtx);
        avformat_close_input(&pFormatCtx);
        return false;
    }
    
    // 打开输出文件
    FILE* outFile = fopen(outputPath.c_str(), "wb");
    if (!outFile) {
        swr_free(&swrCtx);
        avcodec_free_context(&codecCtx);
        avformat_close_input(&pFormatCtx);
        return false;
    }
    
    // 如果是 WAV 格式，写入 WAV 头（简化版，实际需要在结束时更新）
    if (format == "wav") {
        // WAV header (44 bytes) - 暂时写占位符
        uint8_t wavHeader[44] = {0};
        fwrite(wavHeader, 1, 44, outFile);
    }
    
    // 读取并处理音频帧
    AVPacket* packet = av_packet_alloc();
    AVFrame* frame = av_frame_alloc();
    uint8_t* convertedSamples = nullptr;
    int maxDstNbSamples = 0;
    
    while (av_read_frame(pFormatCtx, packet) >= 0) {
        if (packet->stream_index == audioStreamIndex) {
            if (avcodec_send_packet(codecCtx, packet) >= 0) {
                while (avcodec_receive_frame(codecCtx, frame) >= 0) {
                    // 重采样
                    int dstNbSamples = av_rescale_rnd(
                        swr_get_delay(swrCtx, codecCtx->sample_rate) + frame->nb_samples,
                        16000,
                        codecCtx->sample_rate,
                        AV_ROUND_UP
                    );
                    
                    if (dstNbSamples > maxDstNbSamples) {
                        av_freep(&convertedSamples);
                        if (av_samples_alloc(&convertedSamples, nullptr, 1, dstNbSamples, 
                                            AV_SAMPLE_FMT_S16, 0) < 0) {
                            break;
                        }
                        maxDstNbSamples = dstNbSamples;
                    }
                    
                    int convertedNbSamples = swr_convert(
                        swrCtx,
                        &convertedSamples, dstNbSamples,
                        (const uint8_t**)frame->data, frame->nb_samples
                    );
                    
                    if (convertedNbSamples > 0) {
                        int dataSize = convertedNbSamples * 2; // 16-bit = 2 bytes
                        fwrite(convertedSamples, 1, dataSize, outFile);
                    }
                }
            }
        }
        av_packet_unref(packet);
    }
    
    // 如果是 WAV，更新头部信息
    if (format == "wav") {
        long fileSize = ftell(outFile);
        fseek(outFile, 0, SEEK_SET);
        
        // 简化的 WAV header
        uint32_t chunkSize = fileSize - 8;
        uint32_t subchunk2Size = fileSize - 44;
        
        fwrite("RIFF", 1, 4, outFile);
        fwrite(&chunkSize, 4, 1, outFile);
        fwrite("WAVE", 1, 4, outFile);
        fwrite("fmt ", 1, 4, outFile);
        uint32_t subchunk1Size = 16;
        fwrite(&subchunk1Size, 4, 1, outFile);
        uint16_t audioFormat = 1; // PCM
        fwrite(&audioFormat, 2, 1, outFile);
        uint16_t numChannels = 1;
        fwrite(&numChannels, 2, 1, outFile);
        uint32_t sampleRate = 16000;
        fwrite(&sampleRate, 4, 1, outFile);
        uint32_t byteRate = 32000; // 16000 * 2 * 1
        fwrite(&byteRate, 4, 1, outFile);
        uint16_t blockAlign = 2;
        fwrite(&blockAlign, 2, 1, outFile);
        uint16_t bitsPerSample = 16;
        fwrite(&bitsPerSample, 2, 1, outFile);
        fwrite("data", 1, 4, outFile);
        fwrite(&subchunk2Size, 4, 1, outFile);
    }
    
    // 清理
    av_freep(&convertedSamples);
    av_frame_free(&frame);
    av_packet_free(&packet);
    fclose(outFile);
    swr_free(&swrCtx);
    avcodec_free_context(&codecCtx);
    avformat_close_input(&pFormatCtx);
    
    return true;
}
```

### 1.3 实现视频信息获取

参考上面的模式实现 `getVideoInfo` 函数。

## 第二部分：集成 Whisper.cpp

### 2.1 下载 Whisper.cpp

```powershell
cd native
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
```

### 2.2 编译 Whisper.cpp

```powershell
mkdir build
cd build
cmake ..
cmake --build . --config Release
```

编译完成后，在 `build/bin/Release/` 目录下会生成 `whisper.dll` 和 `whisper.lib`。

### 2.3 完善 whisper_wrapper.cpp

```cpp
#include "whisper.h"
#include <fstream>
#include <vector>

bool WhisperWrapper::loadModel(const std::string& modelPath) {
    if (ctx != nullptr) {
        whisper_free(static_cast<whisper_context*>(ctx));
    }
    
    whisper_context* new_ctx = whisper_init_from_file(modelPath.c_str());
    if (new_ctx == nullptr) {
        modelLoaded = false;
        return false;
    }
    
    ctx = new_ctx;
    modelLoaded = true;
    return true;
}

// 辅助函数：读取 WAV 文件
bool read_wav(const std::string& filename, std::vector<float>& pcmf32, 
              int& sampleRate, int& channels) {
    std::ifstream file(filename, std::ios::binary);
    if (!file.is_open()) {
        return false;
    }
    
    // 读取 WAV 头
    char header[44];
    file.read(header, 44);
    
    // 解析 WAV 头
    sampleRate = *reinterpret_cast<int*>(&header[24]);
    channels = *reinterpret_cast<short*>(&header[22]);
    
    // 读取音频数据
    file.seekg(0, std::ios::end);
    size_t fileSize = file.tellg();
    size_t dataSize = fileSize - 44;
    file.seekg(44);
    
    std::vector<int16_t> pcm16(dataSize / 2);
    file.read(reinterpret_cast<char*>(pcm16.data()), dataSize);
    
    // 转换为 float
    pcmf32.resize(pcm16.size());
    for (size_t i = 0; i < pcm16.size(); i++) {
        pcmf32[i] = static_cast<float>(pcm16[i]) / 32768.0f;
    }
    
    return true;
}

std::vector<TranscriptSegment> WhisperWrapper::transcribe(
    const std::string& audioPath, 
    const std::string& language) {
    
    if (!modelLoaded) {
        throw std::runtime_error("Model not loaded");
    }
    
    // 读取音频
    std::vector<float> pcmf32;
    int sampleRate, channels;
    if (!read_wav(audioPath, pcmf32, sampleRate, channels)) {
        throw std::runtime_error("Failed to read audio file");
    }
    
    // 如果不是单声道，转换为单声道
    if (channels > 1) {
        std::vector<float> mono;
        mono.reserve(pcmf32.size() / channels);
        for (size_t i = 0; i < pcmf32.size(); i += channels) {
            float sum = 0;
            for (int c = 0; c < channels; c++) {
                sum += pcmf32[i + c];
            }
            mono.push_back(sum / channels);
        }
        pcmf32 = std::move(mono);
    }
    
    // 设置 Whisper 参数
    whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    params.language = language.c_str();
    params.translate = false;
    params.print_timestamps = true;
    params.print_progress = false;
    params.print_realtime = false;
    params.print_special = false;
    
    // 执行转录
    whisper_context* wctx = static_cast<whisper_context*>(ctx);
    if (whisper_full(wctx, params, pcmf32.data(), pcmf32.size()) != 0) {
        throw std::runtime_error("Failed to transcribe");
    }
    
    // 获取结果
    std::vector<TranscriptSegment> segments;
    const int n_segments = whisper_full_n_segments(wctx);
    
    for (int i = 0; i < n_segments; ++i) {
        TranscriptSegment segment;
        segment.startTime = static_cast<double>(whisper_full_get_segment_t0(wctx, i)) / 100.0;
        segment.endTime = static_cast<double>(whisper_full_get_segment_t1(wctx, i)) / 100.0;
        segment.text = whisper_full_get_segment_text(wctx, i);
        segments.push_back(segment);
    }
    
    return segments;
}
```

## 第三部分：编译 Native 模块

### 3.1 安装编译工具

确保已安装：
- Visual Studio Build Tools
- Python 3.x
- CMake

### 3.2 编译

```powershell
npm run build:native
```

如果遇到错误，可以手动运行：
```powershell
node-gyp rebuild
```

### 3.3 验证编译结果

编译成功后，在 `build/Release/` 目录下应该有：
- `llvideo.node`
- `llwhisper.node`
- 以及相关的 DLL 文件

## 第四部分：下载模型

### 4.1 Whisper 模型

从 Hugging Face 下载预训练模型：
https://huggingface.co/ggerganov/whisper.cpp

推荐模型：
- `ggml-base.bin` (~140MB) - 适合一般使用
- `ggml-small.bin` (~460MB) - 更准确
- `ggml-medium.bin` (~1.5GB) - 最佳质量

下载后放到 `models/whisper/` 目录。

### 4.2 翻译模型（待实现）

翻译功能可以考虑以下方案：
1. 集成 GGUF 格式的翻译模型（如 OPUS-MT）
2. 使用在线翻译 API
3. 集成本地翻译引擎

## 第五部分：测试

### 5.1 测试 FFmpeg 集成

```javascript
const llvideo = require('./build/Release/llvideo.node');

// 测试获取视频信息
const info = llvideo.getVideoInfo('test.mp4');
console.log('Video info:', info);

// 测试提取音频
llvideo.extractAudio('test.mp4', 'output.wav', 'wav');
console.log('Audio extracted');
```

### 5.2 测试 Whisper 集成

```javascript
const llwhisper = require('./build/Release/llwhisper.node');

// 加载模型
llwhisper.loadModel('models/whisper/ggml-base.bin');

// 转录
const segments = llwhisper.transcribe('output.wav', 'ja');
console.log('Segments:', segments);
```

## 常见问题

### Q: node-gyp 编译失败
A: 确保安装了 Visual Studio Build Tools 和 Python 3.x

### Q: 找不到 FFmpeg 库
A: 检查 `binding.gyp` 中的路径是否正确

### Q: Whisper 转录很慢
A: 考虑使用 GPU 加速版本的 Whisper.cpp（需要 CUDA）

### Q: 内存不足
A: 使用较小的 Whisper 模型或分段处理长音频

## 参考资源

- FFmpeg: https://ffmpeg.org/documentation.html
- Whisper.cpp: https://github.com/ggerganov/whisper.cpp
- Node-API: https://nodejs.org/api/n-api.html
- node-addon-api: https://github.com/nodejs/node-addon-api
