#include <napi.h>
#include <iostream>
#include "../include/whisper_wrapper.h"
#include "../include/translate_wrapper.h"

using namespace Napi;

// Whisper Wrapper 实例
static llwhisper::WhisperWrapper* whisperWrapper = nullptr;

// 翻译 Wrapper 实例
static lltranslate::TranslateWrapper* translateWrapper = nullptr;

// 加载模型
Napi::Value LoadModel(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected string argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string modelPath = info[0].As<Napi::String>().Utf8Value();
    
    try {
        if (whisperWrapper == nullptr) {
            whisperWrapper = new llwhisper::WhisperWrapper();
        }
        
        bool result = whisperWrapper->loadModel(modelPath);
        
        if (!result) {
            Napi::Error::New(env, "Failed to load model").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        return Napi::Boolean::New(env, true);
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

// 转录音频（完整参数版本）
Napi::Value Transcribe(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Expected at least 1 argument (audioPath)").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (!info[0].IsString()) {
        Napi::TypeError::New(env, "First argument must be a string (audioPath)").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string audioPath = info[0].As<Napi::String>().Utf8Value();
    
    try {
        if (whisperWrapper == nullptr || !whisperWrapper->isModelLoaded()) {
            Napi::Error::New(env, "Model not loaded. Call loadModel first.").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        llwhisper::WhisperParams params;
        
        // 如果提供了第二个参数（可以是字符串或对象）
        if (info.Length() >= 2) {
            if (info[1].IsString()) {
                // 简单模式：只提供语言
                params.language = info[1].As<Napi::String>().Utf8Value();
            } else if (info[1].IsObject()) {
                // 完整模式：提供参数对象
                Napi::Object options = info[1].As<Napi::Object>();
                
                if (options.Has("language")) {
                    params.language = options.Get("language").As<Napi::String>().Utf8Value();
                }
                if (options.Has("translate")) {
                    params.translate = options.Get("translate").As<Napi::Boolean>().Value();
                }
                if (options.Has("n_threads")) {
                    params.n_threads = options.Get("n_threads").As<Napi::Number>().Int32Value();
                }
                if (options.Has("offset_ms")) {
                    params.offset_ms = options.Get("offset_ms").As<Napi::Number>().Int32Value();
                }
                if (options.Has("duration_ms")) {
                    params.duration_ms = options.Get("duration_ms").As<Napi::Number>().Int32Value();
                }
                if (options.Has("entropy_thold")) {
                    params.entropy_thold = options.Get("entropy_thold").As<Napi::Number>().FloatValue();
                }
                if (options.Has("logprob_thold")) {
                    params.logprob_thold = options.Get("logprob_thold").As<Napi::Number>().FloatValue();
                }
                if (options.Has("temperature")) {
                    params.temperature = options.Get("temperature").As<Napi::Number>().FloatValue();
                }
                if (options.Has("suppress_nst")) {
                    params.suppress_non_speech_tokens = options.Get("suppress_nst").As<Napi::Boolean>().Value();
                }
                if (options.Has("best_of")) {
                    params.best_of = options.Get("best_of").As<Napi::Number>().Int32Value();
                }
                if (options.Has("beam_size")) {
                    params.beam_size = options.Get("beam_size").As<Napi::Number>().Int32Value();
                }
                if (options.Has("print_timestamps")) {
                    params.print_timestamps = options.Get("print_timestamps").As<Napi::Boolean>().Value();
                }
                if (options.Has("print_progress")) {
                    params.print_progress = options.Get("print_progress").As<Napi::Boolean>().Value();
                }
            }
        }
        
        std::vector<llwhisper::TranscriptSegment> segments = whisperWrapper->transcribe(audioPath, params);
        
        Napi::Array result = Napi::Array::New(env, segments.size());
        for (size_t i = 0; i < segments.size(); i++) {
            Napi::Object obj = Napi::Object::New(env);
            obj.Set("startTime", Napi::Number::New(env, segments[i].startTime));
            obj.Set("endTime", Napi::Number::New(env, segments[i].endTime));
            obj.Set("text", Napi::String::New(env, segments[i].text));
            result.Set(i, obj);
        }
        
        return result;
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

// 导出为不同格式
Napi::Value ExportToTxt(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "Expected array of segments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Array segmentsArray = info[0].As<Napi::Array>();
    std::vector<llwhisper::TranscriptSegment> segments;
    
    for (uint32_t i = 0; i < segmentsArray.Length(); i++) {
        Napi::Object obj = segmentsArray.Get(i).As<Napi::Object>();
        llwhisper::TranscriptSegment seg;
        seg.startTime = obj.Get("startTime").As<Napi::Number>().DoubleValue();
        seg.endTime = obj.Get("endTime").As<Napi::Number>().DoubleValue();
        seg.text = obj.Get("text").As<Napi::String>().Utf8Value();
        segments.push_back(seg);
    }
    
    if (whisperWrapper) {
        std::string result = whisperWrapper->exportToTxt(segments);
        return Napi::String::New(env, result);
    }
    
    return env.Null();
}

Napi::Value ExportToSrt(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "Expected array of segments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Array segmentsArray = info[0].As<Napi::Array>();
    std::vector<llwhisper::TranscriptSegment> segments;
    
    for (uint32_t i = 0; i < segmentsArray.Length(); i++) {
        Napi::Object obj = segmentsArray.Get(i).As<Napi::Object>();
        llwhisper::TranscriptSegment seg;
        seg.startTime = obj.Get("startTime").As<Napi::Number>().DoubleValue();
        seg.endTime = obj.Get("endTime").As<Napi::Number>().DoubleValue();
        seg.text = obj.Get("text").As<Napi::String>().Utf8Value();
        segments.push_back(seg);
    }
    
    if (whisperWrapper) {
        std::string result = whisperWrapper->exportToSrt(segments);
        return Napi::String::New(env, result);
    }
    
    return env.Null();
}

Napi::Value ExportToVtt(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "Expected array of segments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Array segmentsArray = info[0].As<Napi::Array>();
    std::vector<llwhisper::TranscriptSegment> segments;
    
    for (uint32_t i = 0; i < segmentsArray.Length(); i++) {
        Napi::Object obj = segmentsArray.Get(i).As<Napi::Object>();
        llwhisper::TranscriptSegment seg;
        seg.startTime = obj.Get("startTime").As<Napi::Number>().DoubleValue();
        seg.endTime = obj.Get("endTime").As<Napi::Number>().DoubleValue();
        seg.text = obj.Get("text").As<Napi::String>().Utf8Value();
        segments.push_back(seg);
    }
    
    if (whisperWrapper) {
        std::string result = whisperWrapper->exportToVtt(segments);
        return Napi::String::New(env, result);
    }
    
    return env.Null();
}

Napi::Value ExportToJson(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "Expected array of segments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Array segmentsArray = info[0].As<Napi::Array>();
    std::vector<llwhisper::TranscriptSegment> segments;
    
    for (uint32_t i = 0; i < segmentsArray.Length(); i++) {
        Napi::Object obj = segmentsArray.Get(i).As<Napi::Object>();
        llwhisper::TranscriptSegment seg;
        seg.startTime = obj.Get("startTime").As<Napi::Number>().DoubleValue();
        seg.endTime = obj.Get("endTime").As<Napi::Number>().DoubleValue();
        seg.text = obj.Get("text").As<Napi::String>().Utf8Value();
        segments.push_back(seg);
    }
    
    if (whisperWrapper) {
        std::string result = whisperWrapper->exportToJson(segments);
        return Napi::String::New(env, result);
    }
    
    return env.Null();
}

Napi::Value ExportToLrc(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "Expected array of segments").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Array segmentsArray = info[0].As<Napi::Array>();
    std::vector<llwhisper::TranscriptSegment> segments;
    
    for (uint32_t i = 0; i < segmentsArray.Length(); i++) {
        Napi::Object obj = segmentsArray.Get(i).As<Napi::Object>();
        llwhisper::TranscriptSegment seg;
        seg.startTime = obj.Get("startTime").As<Napi::Number>().DoubleValue();
        seg.endTime = obj.Get("endTime").As<Napi::Number>().DoubleValue();
        seg.text = obj.Get("text").As<Napi::String>().Utf8Value();
        segments.push_back(seg);
    }
    
    if (whisperWrapper) {
        std::string result = whisperWrapper->exportToLrc(segments);
        return Napi::String::New(env, result);
    }
    
    return env.Null();
}

// ============ 翻译功能 ============

/** 加载翻译模型 */
Napi::Value LoadTranslateModel(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected string argument (modelPath)").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string modelPath = info[0].As<Napi::String>().Utf8Value();
    std::string device = "cpu";
    
    if (info.Length() >= 2 && info[1].IsString()) {
        device = info[1].As<Napi::String>().Utf8Value();
    }
    
    try {
        if (translateWrapper == nullptr) {
            translateWrapper = new lltranslate::TranslateWrapper();
        }
        
        bool result = translateWrapper->loadModel(modelPath, device);
        
        if (!result) {
            Napi::Error::New(env, "Failed to load translation model").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        return Napi::Boolean::New(env, true);
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

/** 加载 SentencePiece tokenizer */
Napi::Value LoadTranslateTokenizer(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected string argument (tokenizerPath)").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string tokenizerPath = info[0].As<Napi::String>().Utf8Value();
    
    try {
        if (translateWrapper == nullptr) {
            Napi::Error::New(env, "Translation model not loaded. Load model first.").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        bool result = translateWrapper->loadTokenizer(tokenizerPath);
        
        if (!result) {
            Napi::Error::New(env, "Failed to load tokenizer").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        return Napi::Boolean::New(env, true);
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

/** 翻译单个文本 */
Napi::Value TranslateText(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    std::cout << "[NAPI] TranslateText called!" << std::endl;
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected string argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string text = info[0].As<Napi::String>().Utf8Value();
    std::cout << "[NAPI] Input text: " << text.substr(0, 50) << "..." << std::endl;
    
    try {
        if (translateWrapper == nullptr || !translateWrapper->isModelLoaded()) {
            std::cout << "[NAPI] ERROR: Translation model not loaded!" << std::endl;
            Napi::Error::New(env, "Translation model not loaded").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        std::cout << "[NAPI] Model is loaded, parsing params..." << std::endl;
        lltranslate::TranslateParams params;
        
        // 解析可选参数
        if (info.Length() >= 2 && info[1].IsObject()) {
            Napi::Object options = info[1].As<Napi::Object>();
            
            if (options.Has("beam_size")) {
                params.beam_size = options.Get("beam_size").As<Napi::Number>().Int32Value();
            }
            if (options.Has("length_penalty")) {
                params.length_penalty = options.Get("length_penalty").As<Napi::Number>().FloatValue();
            }
            if (options.Has("max_batch_size")) {
                params.max_batch_size = options.Get("max_batch_size").As<Napi::Number>().Int32Value();
            }
            if (options.Has("target_prefix")) {
                Napi::Value targetPrefixValue = options.Get("target_prefix");
                if (targetPrefixValue.IsArray()) {
                    Napi::Array targetPrefixArray = targetPrefixValue.As<Napi::Array>();
                    std::cout << "[NAPI] target_prefix array length: " << targetPrefixArray.Length() << std::endl;
                    for (uint32_t i = 0; i < targetPrefixArray.Length(); i++) {
                        std::string prefix = targetPrefixArray.Get(i).As<Napi::String>().Utf8Value();
                        std::cout << "[NAPI] target_prefix[" << i << "]: " << prefix << std::endl;
                        params.target_prefix.push_back(prefix);
                    }
                }
            }
        }
        
        std::cout << "[NAPI] Calling translateWrapper->translate()..." << std::endl;
        std::string result = translateWrapper->translate(text, params);
        std::cout << "[NAPI] translate() returned successfully!" << std::endl;
        std::cout << "[NAPI] Result: " << result.substr(0, 50) << "..." << std::endl;
        
        return Napi::String::New(env, result);
        
    } catch (const std::exception& e) {
        std::cout << "[NAPI] Exception caught: " << e.what() << std::endl;
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

/** 批量翻译 */
Napi::Value TranslateBatch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    std::cout << "[NAPI] TranslateBatch called!" << std::endl;
    
    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "Expected array of strings").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Array textsArray = info[0].As<Napi::Array>();
    std::vector<std::string> texts;
    
    std::cout << "[NAPI] Batch size: " << textsArray.Length() << std::endl;
    for (uint32_t i = 0; i < textsArray.Length(); i++) {
        std::string text = textsArray.Get(i).As<Napi::String>().Utf8Value();
        texts.push_back(text);
        std::cout << "[NAPI] Text[" << i << "]: " << text.substr(0, 30) << "..." << std::endl;
    }
    
    try {
        if (translateWrapper == nullptr || !translateWrapper->isModelLoaded()) {
            std::cout << "[NAPI] ERROR: Translation model not loaded!" << std::endl;
            Napi::Error::New(env, "Translation model not loaded").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        std::cout << "[NAPI] Model is loaded, parsing params..." << std::endl;
        
        lltranslate::TranslateParams params;
        
        if (info.Length() >= 2 && info[1].IsObject()) {
            Napi::Object options = info[1].As<Napi::Object>();
            
            if (options.Has("beam_size")) {
                params.beam_size = options.Get("beam_size").As<Napi::Number>().Int32Value();
            }
            if (options.Has("length_penalty")) {
                params.length_penalty = options.Get("length_penalty").As<Napi::Number>().FloatValue();
            }
            if (options.Has("target_prefix")) {
                Napi::Value targetPrefixValue = options.Get("target_prefix");
                if (targetPrefixValue.IsArray()) {
                    Napi::Array targetPrefixArray = targetPrefixValue.As<Napi::Array>();
                    std::cout << "[NAPI] target_prefix array length: " << targetPrefixArray.Length() << std::endl;
                    for (uint32_t i = 0; i < targetPrefixArray.Length(); i++) {
                        std::string prefix = targetPrefixArray.Get(i).As<Napi::String>().Utf8Value();
                        std::cout << "[NAPI] target_prefix[" << i << "]: " << prefix << std::endl;
                        params.target_prefix.push_back(prefix);
                    }
                }
            }
        }
        
        std::cout << "[NAPI] Calling translateWrapper->translateBatch()..." << std::endl;
        std::vector<std::string> results = translateWrapper->translateBatch(texts, params);
        std::cout << "[NAPI] translateBatch() returned successfully!" << std::endl;
        std::cout << "[NAPI] Results count: " << results.size() << std::endl;
        
        Napi::Array resultArray = Napi::Array::New(env, results.size());
        for (size_t i = 0; i < results.size(); i++) {
            std::cout << "[NAPI] Setting result[" << i << "]..." << std::endl;
            resultArray.Set(i, Napi::String::New(env, results[i]));
        }
        
        std::cout << "[NAPI] Returning result array..." << std::endl;
        return resultArray;
        
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

/** 使用预先tokenized的tokens进行翻译 */
Napi::Value TranslateWithTokens(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "Expected array of token strings").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Array tokensArray = info[0].As<Napi::Array>();
    std::vector<std::string> tokens;
    
    for (uint32_t i = 0; i < tokensArray.Length(); i++) {
        tokens.push_back(tokensArray.Get(i).As<Napi::String>().Utf8Value());
    }
    
    try {
        if (translateWrapper == nullptr || !translateWrapper->isModelLoaded()) {
            Napi::Error::New(env, "Translation model not loaded").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        lltranslate::TranslateParams params;
        
        // 解析可选参数
        if (info.Length() >= 2 && info[1].IsObject()) {
            Napi::Object options = info[1].As<Napi::Object>();
            
            if (options.Has("beam_size")) {
                params.beam_size = options.Get("beam_size").As<Napi::Number>().Int32Value();
            }
            if (options.Has("length_penalty")) {
                params.length_penalty = options.Get("length_penalty").As<Napi::Number>().FloatValue();
            }
            if (options.Has("target_prefix")) {
                Napi::Value targetPrefixValue = options.Get("target_prefix");
                if (targetPrefixValue.IsArray()) {
                    Napi::Array targetPrefixArray = targetPrefixValue.As<Napi::Array>();
                    for (uint32_t i = 0; i < targetPrefixArray.Length(); i++) {
                        params.target_prefix.push_back(targetPrefixArray.Get(i).As<Napi::String>().Utf8Value());
                    }
                }
            }
        }
        
        std::string result = translateWrapper->translateWithTokens(tokens, params);
        return Napi::String::New(env, result);
        
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

// 模块初始化
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Whisper 功能
    exports.Set("loadModel", Napi::Function::New(env, LoadModel));
    exports.Set("transcribe", Napi::Function::New(env, Transcribe));
    exports.Set("exportToTxt", Napi::Function::New(env, ExportToTxt));
    exports.Set("exportToSrt", Napi::Function::New(env, ExportToSrt));
    exports.Set("exportToVtt", Napi::Function::New(env, ExportToVtt));
    exports.Set("exportToJson", Napi::Function::New(env, ExportToJson));
    exports.Set("exportToLrc", Napi::Function::New(env, ExportToLrc));
    
    // 翻译功能
    exports.Set("loadTranslateModel", Napi::Function::New(env, LoadTranslateModel));
    exports.Set("loadTranslateTokenizer", Napi::Function::New(env, LoadTranslateTokenizer));
    exports.Set("translateText", Napi::Function::New(env, TranslateText));
    exports.Set("translateBatch", Napi::Function::New(env, TranslateBatch));
    exports.Set("translateWithTokens", Napi::Function::New(env, TranslateWithTokens));
    
    return exports;
}

NODE_API_MODULE(llwhisper, Init)
