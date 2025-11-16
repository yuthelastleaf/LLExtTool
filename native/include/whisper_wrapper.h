#ifndef WHISPER_WRAPPER_H
#define WHISPER_WRAPPER_H

#include <string>
#include <vector>
#include <functional>

namespace llwhisper {

struct TranscriptSegment {
    double startTime;
    double endTime;
    std::string text;
};

// Whisper 参数配置
struct WhisperParams {
    // 模型和语言
    std::string language = "auto";        // 语言代码 (en, zh, ja, auto 等)
    bool translate = false;               // 翻译为英语
    
    // 输出格式
    bool print_timestamps = true;         // 打印时间戳
    bool print_progress = false;          // 打印进度
    bool print_special = false;           // 打印特殊标记
    
    // 采样策略
    int n_threads = 4;                    // 线程数
    int n_max_text_ctx = 16384;          // 最大文本上下文
    int offset_ms = 0;                    // 时间偏移（毫秒）
    int duration_ms = 0;                  // 处理时长（0=全部）
    
    // 解码参数
    bool no_context = false;              // 不使用历史上下文
    bool single_segment = false;          // 强制单段输出
    int max_len = 0;                      // 最大段长度（0=默认）
    
    // 高级参数
    float entropy_thold = 2.4f;           // 熵阈值 (-et)
    float logprob_thold = -1.0f;          // 对数概率阈值 (-lpt)
    float temperature = 0.0f;             // 温度
    float temperature_inc = 0.2f;         // 温度增量
    
    // Beam search
    int best_of = 5;                      // 候选数量
    int beam_size = -1;                   // Beam 大小 (-1=禁用)
    
    // VAD 和静音检测
    float word_thold = 0.01f;             // 词阈值
    bool speed_up = false;                // 2x 加速
    int audio_ctx = 0;                    // 音频上下文大小
    
    // 压制参数
    bool suppress_non_speech_tokens = false;  // 抑制非语音标记 (--suppress-nst)
    
    // 输出格式选项
    bool output_txt = false;              // 输出纯文本
    bool output_srt = false;              // 输出 SRT 字幕
    bool output_vtt = false;              // 输出 VTT 字幕
    bool output_json = false;             // 输出 JSON
    bool output_lrc = false;              // 输出 LRC 歌词
};

// 进度回调
using ProgressCallback = std::function<void(int progress)>;

class WhisperWrapper {
public:
    WhisperWrapper();
    ~WhisperWrapper();

    // 加载模型
    bool loadModel(const std::string& modelPath);

    // 转录音频（使用参数结构）
    std::vector<TranscriptSegment> transcribe(const std::string& audioPath, 
                                               const WhisperParams& params,
                                               ProgressCallback callback = nullptr);

    // 简化的转录接口（向后兼容）
    std::vector<TranscriptSegment> transcribe(const std::string& audioPath, 
                                               const std::string& language);

    // 导出为不同格式
    std::string exportToTxt(const std::vector<TranscriptSegment>& segments);
    std::string exportToSrt(const std::vector<TranscriptSegment>& segments);
    std::string exportToVtt(const std::vector<TranscriptSegment>& segments);
    std::string exportToJson(const std::vector<TranscriptSegment>& segments);
    std::string exportToLrc(const std::vector<TranscriptSegment>& segments);

    // 检查模型是否已加载
    bool isModelLoaded() const;
    
    // 获取最后一次错误
    std::string getLastError() const;

private:
    void* ctx;  // whisper_context pointer
    bool modelLoaded;
    std::string lastError;
    
    // 格式化时间戳
    std::string formatTimestamp(double seconds, bool srtFormat = false);
};

} // namespace llwhisper

#endif // WHISPER_WRAPPER_H
