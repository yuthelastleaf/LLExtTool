# 集成 CTranslate2 翻译功能到 llwhisper 模块

## 准备工作

### 1. 下载 CTranslate2

访问 [CTranslate2 Releases](https://github.com/OpenNMT/CTranslate2/releases)，下载最新的 Windows x64 版本：
- 文件名类似：`ctranslate2-4.x.x-windows-x64.zip`

解压后的目录结构：
```
native/ctranslate2/
├── include/
│   └── ctranslate2/
│       ├── translator.h
│       ├── models/
│       └── ...
├── lib/
│   └── ctranslate2.lib
└── bin/
    └── ctranslate2.dll
```

### 2. 下载翻译模型

使用 ct2-transformers-converter 转换模型（需要 Python）：

```bash
# 安装工具
pip install ctranslate2 transformers sentencepiece

# 转换日译中模型（Opus-MT）
ct2-transformers-converter --model Helsinki-NLP/opus-mt-ja-zh --output_dir models/opus-mt-ja-zh-ct2

# 或者使用 MarianMT
ct2-transformers-converter --model Helsinki-NLP/opus-mt-jap-zho --output_dir models/opus-mt-jap-zho-ct2
```

转换后的模型目录结构：
```
native/models/
└── opus-mt-ja-zh-ct2/
    ├── model.bin
    ├── shared_vocabulary.txt (或 source_vocabulary.txt + target_vocabulary.txt)
    └── config.json
```

## 实现步骤

### 步骤 1: 创建翻译 Wrapper

创建 `native/include/translate_wrapper.h`：

```cpp
#pragma once
#include <string>
#include <vector>
#include <memory>

// 前向声明，避免头文件依赖
namespace ctranslate2 {
    class Translator;
}

namespace lltranslate {

struct TranslateParams {
    int beam_size = 4;           // Beam search 宽度
    float length_penalty = 1.0f; // 长度惩罚
    int max_batch_size = 32;     // 最大批处理大小
    bool use_vmap = false;       // 使用词汇映射
};

class TranslateWrapper {
public:
    TranslateWrapper();
    ~TranslateWrapper();
    
    // 加载翻译模型
    bool loadModel(const std::string& modelPath, const std::string& device = "cpu");
    
    // 单句翻译
    std::string translate(const std::string& text, const TranslateParams& params = TranslateParams());
    
    // 批量翻译
    std::vector<std::string> translateBatch(const std::vector<std::string>& texts, 
                                           const TranslateParams& params = TranslateParams());
    
    // 检查模型是否已加载
    bool isModelLoaded() const { return model_loaded_; }
    
    // 获取支持的设备
    static std::vector<std::string> getSupportedDevices();
    
private:
    std::unique_ptr<ctranslate2::Translator> translator_;
    bool model_loaded_;
    
    // Tokenization helpers
    std::vector<std::string> tokenize(const std::string& text);
    std::string detokenize(const std::vector<std::string>& tokens);
};

} // namespace lltranslate
```

### 步骤 2: 实现翻译 Wrapper

创建 `native/src/translate_wrapper.cpp`：

```cpp
#include "../include/translate_wrapper.h"
#include <ctranslate2/translator.h>
#include <iostream>
#include <sstream>
#include <algorithm>

namespace lltranslate {

TranslateWrapper::TranslateWrapper() : model_loaded_(false) {}

TranslateWrapper::~TranslateWrapper() {
    translator_.reset();
}

bool TranslateWrapper::loadModel(const std::string& modelPath, const std::string& device) {
    try {
        std::cout << "[Translate] Loading model from: " << modelPath << std::endl;
        std::cout << "[Translate] Using device: " << device << std::endl;
        
        // 创建 Translator 实例
        translator_ = std::make_unique<ctranslate2::Translator>(
            modelPath,
            device,
            ctranslate2::ComputeType::DEFAULT
        );
        
        model_loaded_ = true;
        std::cout << "[Translate] ✓ Model loaded successfully" << std::endl;
        return true;
        
    } catch (const std::exception& e) {
        std::cerr << "[Translate] ✗ Failed to load model: " << e.what() << std::endl;
        model_loaded_ = false;
        return false;
    }
}

std::vector<std::string> TranslateWrapper::tokenize(const std::string& text) {
    // 简单的空格分词（实际应该使用 SentencePiece）
    std::vector<std::string> tokens;
    std::istringstream iss(text);
    std::string token;
    while (iss >> token) {
        tokens.push_back(token);
    }
    return tokens;
}

std::string TranslateWrapper::detokenize(const std::vector<std::string>& tokens) {
    std::string result;
    for (size_t i = 0; i < tokens.size(); ++i) {
        if (i > 0) result += " ";
        result += tokens[i];
    }
    return result;
}

std::string TranslateWrapper::translate(const std::string& text, const TranslateParams& params) {
    if (!model_loaded_) {
        throw std::runtime_error("Model not loaded");
    }
    
    try {
        // Tokenize input
        std::vector<std::string> tokens = tokenize(text);
        
        // 翻译选项
        ctranslate2::TranslationOptions options;
        options.beam_size = params.beam_size;
        options.length_penalty = params.length_penalty;
        options.max_batch_size = params.max_batch_size;
        options.use_vmap = params.use_vmap;
        
        // 执行翻译
        std::vector<ctranslate2::TranslationResult> results = 
            translator_->translate_batch({tokens}, options);
        
        // 提取结果
        if (!results.empty() && !results[0].hypotheses.empty()) {
            return detokenize(results[0].hypotheses[0]);
        }
        
        return "";
        
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Translation failed: ") + e.what());
    }
}

std::vector<std::string> TranslateWrapper::translateBatch(
    const std::vector<std::string>& texts,
    const TranslateParams& params) {
    
    if (!model_loaded_) {
        throw std::runtime_error("Model not loaded");
    }
    
    try {
        // Tokenize all inputs
        std::vector<std::vector<std::string>> batch_tokens;
        for (const auto& text : texts) {
            batch_tokens.push_back(tokenize(text));
        }
        
        // 翻译选项
        ctranslate2::TranslationOptions options;
        options.beam_size = params.beam_size;
        options.length_penalty = params.length_penalty;
        options.max_batch_size = params.max_batch_size;
        options.use_vmap = params.use_vmap;
        
        // 批量翻译
        std::vector<ctranslate2::TranslationResult> results = 
            translator_->translate_batch(batch_tokens, options);
        
        // 收集结果
        std::vector<std::string> translations;
        for (const auto& result : results) {
            if (!result.hypotheses.empty()) {
                translations.push_back(detokenize(result.hypotheses[0]));
            } else {
                translations.push_back("");
            }
        }
        
        return translations;
        
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Batch translation failed: ") + e.what());
    }
}

std::vector<std::string> TranslateWrapper::getSupportedDevices() {
    return {"cpu", "cuda", "auto"};
}

} // namespace lltranslate
```

### 步骤 3: 在 llwhisper.cpp 中添加翻译功能

在 `native/src/llwhisper.cpp` 末尾添加：

```cpp
#include "../include/translate_wrapper.h"

// 翻译 Wrapper 实例
static lltranslate::TranslateWrapper* translateWrapper = nullptr;

// 加载翻译模型
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

// 翻译单个文本
Napi::Value TranslateText(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected string argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string text = info[0].As<Napi::String>().Utf8Value();
    
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
            if (options.Has("max_batch_size")) {
                params.max_batch_size = options.Get("max_batch_size").As<Napi::Number>().Int32Value();
            }
        }
        
        std::string result = translateWrapper->translate(text, params);
        return Napi::String::New(env, result);
        
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

// 批量翻译
Napi::Value TranslateBatch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsArray()) {
        Napi::TypeError::New(env, "Expected array of strings").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    Napi::Array textsArray = info[0].As<Napi::Array>();
    std::vector<std::string> texts;
    
    for (uint32_t i = 0; i < textsArray.Length(); i++) {
        texts.push_back(textsArray.Get(i).As<Napi::String>().Utf8Value());
    }
    
    try {
        if (translateWrapper == nullptr || !translateWrapper->isModelLoaded()) {
            Napi::Error::New(env, "Translation model not loaded").ThrowAsJavaScriptException();
            return env.Null();
        }
        
        lltranslate::TranslateParams params;
        
        if (info.Length() >= 2 && info[1].IsObject()) {
            Napi::Object options = info[1].As<Napi::Object>();
            
            if (options.Has("beam_size")) {
                params.beam_size = options.Get("beam_size").As<Napi::Number>().Int32Value();
            }
            if (options.Has("length_penalty")) {
                params.length_penalty = options.Get("length_penalty").As<Napi::Number>().FloatValue();
            }
        }
        
        std::vector<std::string> results = translateWrapper->translateBatch(texts, params);
        
        Napi::Array resultArray = Napi::Array::New(env, results.size());
        for (size_t i = 0; i < results.size(); i++) {
            resultArray.Set(i, Napi::String::New(env, results[i]));
        }
        
        return resultArray;
        
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

// 在 Init 函数中添加导出
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // ... 现有的导出 ...
    
    // 翻译功能
    exports.Set("loadTranslateModel", Napi::Function::New(env, LoadTranslateModel));
    exports.Set("translateText", Napi::Function::New(env, TranslateText));
    exports.Set("translateBatch", Napi::Function::New(env, TranslateBatch));
    
    return exports;
}
```

### 步骤 4: 更新 binding.gyp

在 `binding.gyp` 的 `llwhisper` target 中添加 CTranslate2 支持：

```json
{
  "target_name": "llwhisper",
  "sources": [
    "native/src/llwhisper.cpp",
    "native/src/whisper_wrapper.cpp",
    "native/src/translate_wrapper.cpp"
  ],
  "include_dirs": [
    "<!@(node -p \"require('node-addon-api').include\")",
    "native/whisper.cpp/include",
    "native/whisper.cpp/ggml/include",
    "native/ffmpeg/include",
    "native/ctranslate2/include"
  ],
  "libraries": [
    "../native/whisper.cpp/build/src/Release/whisper.lib",
    "../native/ffmpeg/lib/avcodec.lib",
    "../native/ffmpeg/lib/avformat.lib",
    "../native/ffmpeg/lib/avutil.lib",
    "../native/ffmpeg/lib/swresample.lib",
    "../native/ctranslate2/lib/ctranslate2.lib"
  ],
  "copies": [{
    "destination": "<(module_root_dir)/build/Release",
    "files": [
      "native/ffmpeg/bin/avcodec-61.dll",
      "native/ffmpeg/bin/avformat-61.dll",
      "native/ffmpeg/bin/avutil-59.dll",
      "native/ffmpeg/bin/swresample-5.dll",
      "native/whisper.cpp/build/bin/ggml-cuda.dll",
      "native/whisper.cpp/build/bin/ggml.dll",
      "native/whisper.cpp/build/bin/ggml-base.dll",
      "native/whisper.cpp/build/bin/ggml-cpu.dll",
      "native/ctranslate2/bin/ctranslate2.dll"
    ]
  }]
}
```

### 步骤 5: TypeScript 类型定义

更新 `native/llwhisper.d.ts`：

```typescript
export interface TranslateParams {
  beam_size?: number;
  length_penalty?: number;
  max_batch_size?: number;
}

export function loadTranslateModel(modelPath: string, device?: 'cpu' | 'cuda' | 'auto'): boolean;
export function translateText(text: string, params?: TranslateParams): string;
export function translateBatch(texts: string[], params?: TranslateParams): string[];
```

### 步骤 6: 在 IPC 处理器中使用

修改 `src/main/ipc-handlers.ts`：

```typescript
// 翻译文本
ipcMain.handle(IpcChannels.TRANSLATE_TEXT, async (_, text: string, sourceLang: string, targetLang: string) => {
  try {
    if (!llwhisper) {
      throw new Error('llwhisper module not loaded');
    }
    
    const result = llwhisper.translateText(text, {
      beam_size: 4,
      length_penalty: 1.0
    });
    
    return result;
  } catch (error: any) {
    throw new Error(`翻译失败: ${error.message}`);
  }
});

// 批量翻译
ipcMain.handle(IpcChannels.BATCH_TRANSLATE, async (_, texts: string[], sourceLang: string, targetLang: string) => {
  try {
    if (!llwhisper) {
      throw new Error('llwhisper module not loaded');
    }
    
    const results = llwhisper.translateBatch(texts, {
      beam_size: 4,
      max_batch_size: 32
    });
    
    return results;
  } catch (error: any) {
    throw new Error(`批量翻译失败: ${error.message}`);
  }
});

// 在初始化时加载翻译模型
function initializeNativeModules() {
  // ... 现有的 Whisper 模型加载 ...
  
  try {
    const translateModelPath = path.join(
      app.getAppPath(),
      'native',
      'models',
      'opus-mt-ja-zh-ct2'
    );
    
    if (fs.existsSync(translateModelPath)) {
      console.log('[Native] Loading translation model...');
      llwhisper.loadTranslateModel(translateModelPath, 'cpu');
      console.log('[Native] ✓ Translation model loaded');
    }
  } catch (error: any) {
    console.error('[Native] ✗ Failed to load translation model:', error.message);
  }
}
```

## 编译和测试

```bash
# 重新编译 native 模块
npx electron-rebuild

# 启动应用测试
npm start
```

## 注意事项

1. **模型大小**：Opus-MT 模型约 300MB，确保有足够空间
2. **首次加载**：翻译模型加载需要几秒钟
3. **性能**：批量翻译比单句翻译效率高得多
4. **分词**：示例代码使用简单分词，实际应该使用 SentencePiece
5. **GPU 支持**：如果有 CUDA，可以使用 `device='cuda'` 加速

## 下一步

1. 完成 CTranslate2 的下载和安装
2. 转换翻译模型到 CT2 格式
3. 实现上述代码
4. 编译和测试

需要我协助具体实现某个部分吗？
