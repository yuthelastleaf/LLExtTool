#include <napi.h>
#include "../include/ffmpeg_wrapper.h"

using namespace Napi;

// FFmpeg Wrapper 实例
static llvideo::FFmpegWrapper* ffmpegWrapper = nullptr;

// 初始化
void EnsureFFmpegInitialized() {
    if (ffmpegWrapper == nullptr) {
        ffmpegWrapper = new llvideo::FFmpegWrapper();
    }
}

// 提取音频
Napi::Value ExtractAudio(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    // extractAudio(inputPath, outputPath, options)
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected at least 2 arguments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (!info[0].IsString() || !info[1].IsString()) {
        Napi::TypeError::New(env, "First two arguments must be strings").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string inputPath = info[0].As<Napi::String>().Utf8Value();
    std::string outputPath = info[1].As<Napi::String>().Utf8Value();
    
    // 默认选项
    llvideo::AudioExtractionOptions options;
    
    // 解析 options 对象
    if (info.Length() >= 3 && info[2].IsObject()) {
        Napi::Object opts = info[2].As<Napi::Object>();
        
        if (opts.Has("sampleRate")) {
            options.sampleRate = opts.Get("sampleRate").As<Napi::Number>().Int32Value();
        }
        if (opts.Has("channels")) {
            options.channels = opts.Get("channels").As<Napi::Number>().Int32Value();
        }
        if (opts.Has("codec")) {
            options.codec = opts.Get("codec").As<Napi::String>().Utf8Value();
        }
        if (opts.Has("format")) {
            options.format = opts.Get("format").As<Napi::String>().Utf8Value();
        }
        if (opts.Has("bitrate")) {
            options.bitrate = opts.Get("bitrate").As<Napi::Number>().Int32Value();
        }
        if (opts.Has("startTime")) {
            options.startTime = opts.Get("startTime").As<Napi::Number>().DoubleValue();
        }
        if (opts.Has("duration")) {
            options.duration = opts.Get("duration").As<Napi::Number>().DoubleValue();
        }
    }
    
    try {
        EnsureFFmpegInitialized();
        
        bool result = ffmpegWrapper->extractAudio(inputPath, outputPath, options);
        
        if (!result) {
            std::string error = ffmpegWrapper->getLastError();
            Napi::Error::New(env, "Failed to extract audio: " + error).ThrowAsJavaScriptException();
            return env.Null();
        }
        
        return Napi::Boolean::New(env, true);
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

// 获取视频信息
Napi::Value GetVideoInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected string argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string inputPath = info[0].As<Napi::String>().Utf8Value();
    
    try {
        EnsureFFmpegInitialized();
        
        llvideo::VideoInfo videoInfo = ffmpegWrapper->getVideoInfo(inputPath);
        
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("format", Napi::String::New(env, videoInfo.format));
        obj.Set("duration", Napi::Number::New(env, videoInfo.duration));
        obj.Set("width", Napi::Number::New(env, videoInfo.width));
        obj.Set("height", Napi::Number::New(env, videoInfo.height));
        obj.Set("fps", Napi::Number::New(env, videoInfo.fps));
        obj.Set("hasAudio", Napi::Boolean::New(env, videoInfo.hasAudio));
        obj.Set("hasVideo", Napi::Boolean::New(env, videoInfo.hasVideo));
        obj.Set("audioCodec", Napi::String::New(env, videoInfo.audioCodec));
        obj.Set("videoCodec", Napi::String::New(env, videoInfo.videoCodec));
        obj.Set("audioSampleRate", Napi::Number::New(env, videoInfo.audioSampleRate));
        obj.Set("audioChannels", Napi::Number::New(env, videoInfo.audioChannels));
        obj.Set("bitrate", Napi::Number::New(env, (double)videoInfo.bitrate));
        
        return obj;
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

// 检查文件是否有效
Napi::Value IsValidMediaFile(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected string argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string inputPath = info[0].As<Napi::String>().Utf8Value();
    
    try {
        EnsureFFmpegInitialized();
        bool isValid = ffmpegWrapper->isValidMediaFile(inputPath);
        return Napi::Boolean::New(env, isValid);
    } catch (const std::exception& e) {
        return Napi::Boolean::New(env, false);
    }
}

// 获取最后的错误
Napi::Value GetLastError(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        EnsureFFmpegInitialized();
        std::string error = ffmpegWrapper->getLastError();
        return Napi::String::New(env, error);
    } catch (const std::exception& e) {
        return Napi::String::New(env, "");
    }
}

// 模块初始化
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("extractAudio", Napi::Function::New(env, ExtractAudio));
    exports.Set("getVideoInfo", Napi::Function::New(env, GetVideoInfo));
    exports.Set("isValidMediaFile", Napi::Function::New(env, IsValidMediaFile));
    exports.Set("getLastError", Napi::Function::New(env, GetLastError));
    return exports;
}

NODE_API_MODULE(llvideo, Init)
