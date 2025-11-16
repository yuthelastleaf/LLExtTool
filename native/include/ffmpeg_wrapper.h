#ifndef FFMPEG_WRAPPER_H
#define FFMPEG_WRAPPER_H

#include <string>
#include <functional>

namespace llvideo {

// 音频提取选项
struct AudioExtractionOptions {
    int sampleRate = 16000;          // 采样率 (默认 16kHz，适合语音识别)
    int channels = 1;                 // 声道数 (1=单声道, 2=立体声)
    std::string codec = "pcm_s16le"; // 音频编码器 (pcm_s16le 为 16-bit PCM)
    std::string format = "wav";       // 输出格式 (wav, mp3, flac 等)
    int bitrate = 0;                  // 比特率 (0=自动)
    double startTime = 0.0;           // 开始时间 (秒)
    double duration = 0.0;            // 持续时间 (0=全部)
};

// 视频信息
struct VideoInfo {
    std::string format;          // 容器格式
    int width = 0;               // 视频宽度
    int height = 0;              // 视频高度
    double duration = 0.0;       // 持续时间 (秒)
    double fps = 0.0;            // 帧率
    std::string audioCodec;      // 音频编码
    std::string videoCodec;      // 视频编码
    int audioSampleRate = 0;     // 音频采样率
    int audioChannels = 0;       // 音频声道数
    int64_t bitrate = 0;         // 比特率
    bool hasAudio = false;       // 是否有音频流
    bool hasVideo = false;       // 是否有视频流
};

// 进度回调函数类型
typedef std::function<void(double)> ProgressCallback;

class FFmpegWrapper {
public:
    FFmpegWrapper();
    ~FFmpegWrapper();

    // 提取音频
    bool extractAudio(const std::string& inputPath, 
                     const std::string& outputPath,
                     const AudioExtractionOptions& options,
                     ProgressCallback callback = nullptr);

    // 获取视频信息
    VideoInfo getVideoInfo(const std::string& inputPath);

    // 获取最后的错误信息
    std::string getLastError() const;

    // 检查文件是否存在且有效
    bool isValidMediaFile(const std::string& inputPath);

private:
    std::string lastError;
    void setError(const std::string& error);
    void init();
    void cleanup();
};

} // namespace llvideo

#endif // FFMPEG_WRAPPER_H
