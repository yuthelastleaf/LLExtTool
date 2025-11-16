#include "whisper_wrapper.h"
#include "../whisper.cpp/include/whisper.h"
#include <fstream>
#include <cstring>
#include <cmath>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libswresample/swresample.h>
#include <libavutil/opt.h>
}

namespace llwhisper {

// Helper function to read audio using FFmpeg
static bool read_wav(const std::string& fname, std::vector<float>& pcmf32, 
                     std::vector<std::vector<float>>& pcmf32s, bool stereo) {
    AVFormatContext* formatCtx = nullptr;
    if (avformat_open_input(&formatCtx, fname.c_str(), nullptr, nullptr) != 0) {
        return false;
    }
    
    if (avformat_find_stream_info(formatCtx, nullptr) < 0) {
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Find audio stream
    int audioStreamIndex = -1;
    for (unsigned int i = 0; i < formatCtx->nb_streams; i++) {
        if (formatCtx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_AUDIO) {
            audioStreamIndex = i;
            break;
        }
    }
    
    if (audioStreamIndex == -1) {
        avformat_close_input(&formatCtx);
        return false;
    }
    
    AVCodecParameters* codecParams = formatCtx->streams[audioStreamIndex]->codecpar;
    const AVCodec* codec = avcodec_find_decoder(codecParams->codec_id);
    if (!codec) {
        avformat_close_input(&formatCtx);
        return false;
    }
    
    AVCodecContext* codecCtx = avcodec_alloc_context3(codec);
    if (!codecCtx) {
        avformat_close_input(&formatCtx);
        return false;
    }
    
    if (avcodec_parameters_to_context(codecCtx, codecParams) < 0) {
        avcodec_free_context(&codecCtx);
        avformat_close_input(&formatCtx);
        return false;
    }
    
    if (avcodec_open2(codecCtx, codec, nullptr) < 0) {
        avcodec_free_context(&codecCtx);
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Setup resampler to convert to 16kHz mono/stereo float
    SwrContext* swrCtx = swr_alloc();
    if (!swrCtx) {
        avcodec_free_context(&codecCtx);
        avformat_close_input(&formatCtx);
        return false;
    }
    
    AVChannelLayout out_ch_layout;
    AVChannelLayout in_ch_layout;
    if (stereo) {
        out_ch_layout = AV_CHANNEL_LAYOUT_STEREO;
    } else {
        out_ch_layout = AV_CHANNEL_LAYOUT_MONO;
    }
    in_ch_layout = codecCtx->ch_layout;
    
    av_opt_set_chlayout(swrCtx, "in_chlayout", &in_ch_layout, 0);
    av_opt_set_chlayout(swrCtx, "out_chlayout", &out_ch_layout, 0);
    av_opt_set_int(swrCtx, "in_sample_rate", codecCtx->sample_rate, 0);
    av_opt_set_int(swrCtx, "out_sample_rate", WHISPER_SAMPLE_RATE, 0);
    av_opt_set_sample_fmt(swrCtx, "in_sample_fmt", codecCtx->sample_fmt, 0);
    av_opt_set_sample_fmt(swrCtx, "out_sample_fmt", AV_SAMPLE_FMT_FLT, 0);
    
    if (swr_init(swrCtx) < 0) {
        swr_free(&swrCtx);
        avcodec_free_context(&codecCtx);
        avformat_close_input(&formatCtx);
        return false;
    }
    
    AVPacket* packet = av_packet_alloc();
    AVFrame* frame = av_frame_alloc();
    
    pcmf32.clear();
    if (stereo) {
        pcmf32s.resize(2);
    }
    
    while (av_read_frame(formatCtx, packet) >= 0) {
        if (packet->stream_index == audioStreamIndex) {
            if (avcodec_send_packet(codecCtx, packet) >= 0) {
                while (avcodec_receive_frame(codecCtx, frame) >= 0) {
                    // Resample
                    int out_samples = av_rescale_rnd(
                        swr_get_delay(swrCtx, codecCtx->sample_rate) + frame->nb_samples,
                        WHISPER_SAMPLE_RATE, codecCtx->sample_rate, AV_ROUND_UP);
                    
                    uint8_t* output = nullptr;
                    int out_linesize;
                    av_samples_alloc(&output, &out_linesize, stereo ? 2 : 1,
                                   out_samples, AV_SAMPLE_FMT_FLT, 0);
                    
                    out_samples = swr_convert(swrCtx, &output, out_samples,
                                            (const uint8_t**)frame->data, frame->nb_samples);
                    
                    float* floatData = (float*)output;
                    if (stereo) {
                        for (int i = 0; i < out_samples; i++) {
                            pcmf32s[0].push_back(floatData[2*i]);
                            pcmf32s[1].push_back(floatData[2*i + 1]);
                        }
                    } else {
                        for (int i = 0; i < out_samples; i++) {
                            pcmf32.push_back(floatData[i]);
                        }
                    }
                    
                    av_freep(&output);
                }
            }
        }
        av_packet_unref(packet);
    }
    
    av_frame_free(&frame);
    av_packet_free(&packet);
    swr_free(&swrCtx);
    avcodec_free_context(&codecCtx);
    avformat_close_input(&formatCtx);
    
    return true;
}

WhisperWrapper::WhisperWrapper() : ctx(nullptr), modelLoaded(false) {
}

WhisperWrapper::~WhisperWrapper() {
    if (ctx != nullptr) {
        whisper_free(static_cast<whisper_context*>(ctx));
        ctx = nullptr;
    }
}

bool WhisperWrapper::loadModel(const std::string& modelPath) {
    if (ctx != nullptr) {
        whisper_free(static_cast<whisper_context*>(ctx));
        ctx = nullptr;
    }
    
    // Check if file exists
    std::ifstream file(modelPath, std::ios::binary);
    if (!file.good()) {
        lastError = "Model file not found: " + modelPath;
        modelLoaded = false;
        return false;
    }
    file.close();
    
    whisper_context* new_ctx = whisper_init_from_file(modelPath.c_str());
    if (new_ctx == nullptr) {
        lastError = "Failed to initialize Whisper context from model file";
        modelLoaded = false;
        return false;
    }
    
    ctx = new_ctx;
    modelLoaded = true;
    lastError.clear();
    return true;
}

std::vector<TranscriptSegment> WhisperWrapper::transcribe(const std::string& audioPath, 
                                                           const WhisperParams& params,
                                                           ProgressCallback callback) {
    if (!modelLoaded) {
        lastError = "Model not loaded. Call loadModel first.";
        throw std::runtime_error(lastError);
    }
    
    std::vector<TranscriptSegment> segments;
    
    // Read audio file
    std::vector<float> pcmf32;
    std::vector<std::vector<float>> pcmf32s;
    
    if (!read_wav(audioPath, pcmf32, pcmf32s, false)) {
        lastError = "Failed to read audio file: " + audioPath;
        throw std::runtime_error(lastError);
    }
    
    if (pcmf32.empty()) {
        lastError = "Audio file is empty or invalid";
        throw std::runtime_error(lastError);
    }
    
    // Set up Whisper parameters
    whisper_full_params wparams = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    
    // 设置语言
    if (params.language != "auto" && !params.language.empty()) {
        wparams.language = params.language.c_str();
    } else {
        wparams.language = "auto";
    }
    
    // 基础参数
    wparams.translate = params.translate;
    wparams.print_progress = params.print_progress;
    wparams.print_timestamps = params.print_timestamps;
    wparams.print_special = params.print_special;
    wparams.print_realtime = false;
    wparams.no_context = params.no_context;
    wparams.single_segment = params.single_segment;
    
    // 线程和性能
    wparams.n_threads = params.n_threads;
    wparams.n_max_text_ctx = params.n_max_text_ctx;
    wparams.offset_ms = params.offset_ms;
    wparams.duration_ms = params.duration_ms;
    
    // 采样参数
    wparams.max_len = params.max_len;
    wparams.greedy.best_of = params.best_of;
    wparams.beam_search.beam_size = params.beam_size;
    
    // 阈值参数
    wparams.entropy_thold = params.entropy_thold;
    wparams.logprob_thold = params.logprob_thold;
    wparams.temperature = params.temperature;
    wparams.temperature_inc = params.temperature_inc;
    
    // 高级参数
    wparams.thold_pt = params.word_thold;
    wparams.thold_ptsum = params.word_thold;
    wparams.audio_ctx = params.audio_ctx;
    
    // 抑制非语音标记
    wparams.suppress_nst = params.suppress_non_speech_tokens;
    
    // Token 时间戳
    wparams.token_timestamps = false;
    wparams.max_tokens = 0;
    
    // 进度回调
    if (callback) {
        // Whisper.cpp doesn't have built-in progress callback in the full API
        // We can estimate progress based on processing
    }
    
    // Run transcription
    whisper_context* wctx = static_cast<whisper_context*>(ctx);
    if (whisper_full(wctx, wparams, pcmf32.data(), pcmf32.size()) != 0) {
        lastError = "Failed to transcribe audio";
        throw std::runtime_error(lastError);
    }
    
    // Get results
    const int n_segments = whisper_full_n_segments(wctx);
    for (int i = 0; i < n_segments; ++i) {
        TranscriptSegment segment;
        segment.startTime = static_cast<double>(whisper_full_get_segment_t0(wctx, i)) / 100.0;
        segment.endTime = static_cast<double>(whisper_full_get_segment_t1(wctx, i)) / 100.0;
        segment.text = whisper_full_get_segment_text(wctx, i);
        
        // Trim whitespace from text
        size_t start = segment.text.find_first_not_of(" \t\n\r");
        size_t end = segment.text.find_last_not_of(" \t\n\r");
        if (start != std::string::npos && end != std::string::npos) {
            segment.text = segment.text.substr(start, end - start + 1);
        }
        
        segments.push_back(segment);
    }
    
    lastError.clear();
    return segments;
}

// 简化接口（向后兼容）
std::vector<TranscriptSegment> WhisperWrapper::transcribe(const std::string& audioPath, 
                                                           const std::string& language) {
    WhisperParams params;
    params.language = language;
    return transcribe(audioPath, params);
}

// 格式化时间戳
std::string WhisperWrapper::formatTimestamp(double seconds, bool srtFormat) {
    int hours = static_cast<int>(seconds / 3600);
    int minutes = static_cast<int>((seconds - hours * 3600) / 60);
    int secs = static_cast<int>(seconds - hours * 3600 - minutes * 60);
    int millis = static_cast<int>((seconds - static_cast<int>(seconds)) * 1000);
    
    char buffer[32];
    if (srtFormat) {
        snprintf(buffer, sizeof(buffer), "%02d:%02d:%02d,%03d", hours, minutes, secs, millis);
    } else {
        snprintf(buffer, sizeof(buffer), "%02d:%02d:%02d.%03d", hours, minutes, secs, millis);
    }
    return std::string(buffer);
}

// 导出为纯文本
std::string WhisperWrapper::exportToTxt(const std::vector<TranscriptSegment>& segments) {
    std::string result;
    for (const auto& seg : segments) {
        result += seg.text + "\n";
    }
    return result;
}

// 导出为 SRT 字幕
std::string WhisperWrapper::exportToSrt(const std::vector<TranscriptSegment>& segments) {
    std::string result;
    int index = 1;
    for (const auto& seg : segments) {
        result += std::to_string(index++) + "\n";
        result += formatTimestamp(seg.startTime, true) + " --> " + formatTimestamp(seg.endTime, true) + "\n";
        result += seg.text + "\n\n";
    }
    return result;
}

// 导出为 VTT 字幕
std::string WhisperWrapper::exportToVtt(const std::vector<TranscriptSegment>& segments) {
    std::string result = "WEBVTT\n\n";
    for (const auto& seg : segments) {
        result += formatTimestamp(seg.startTime, false) + " --> " + formatTimestamp(seg.endTime, false) + "\n";
        result += seg.text + "\n\n";
    }
    return result;
}

// 导出为 JSON
std::string WhisperWrapper::exportToJson(const std::vector<TranscriptSegment>& segments) {
    std::string result = "{\n  \"segments\": [\n";
    for (size_t i = 0; i < segments.size(); ++i) {
        const auto& seg = segments[i];
        result += "    {\n";
        result += "      \"start\": " + std::to_string(seg.startTime) + ",\n";
        result += "      \"end\": " + std::to_string(seg.endTime) + ",\n";
        result += "      \"text\": \"" + seg.text + "\"\n";
        result += "    }";
        if (i < segments.size() - 1) result += ",";
        result += "\n";
    }
    result += "  ]\n}\n";
    return result;
}

// 导出为 LRC 歌词
std::string WhisperWrapper::exportToLrc(const std::vector<TranscriptSegment>& segments) {
    std::string result;
    for (const auto& seg : segments) {
        int minutes = static_cast<int>(seg.startTime / 60);
        double seconds = seg.startTime - minutes * 60;
        char buffer[16];
        snprintf(buffer, sizeof(buffer), "[%02d:%05.2f]", minutes, seconds);
        result += std::string(buffer) + " " + seg.text + "\n";
    }
    return result;
}

bool WhisperWrapper::isModelLoaded() const {
    return modelLoaded;
}

std::string WhisperWrapper::getLastError() const {
    return lastError;
}

} // namespace llwhisper
