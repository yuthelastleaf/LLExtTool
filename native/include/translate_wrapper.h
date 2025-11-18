#pragma once
#include <string>
#include <vector>
#include <memory>

// 前向声明，避免头文件依赖
namespace ctranslate2 {
    class Translator;
}

namespace lltranslate {
    class SentencePieceTokenizer;  // Forward declaration

struct TranslateParams {
    int beam_size = 4;                         // Beam search 宽度
    float length_penalty = 1.0f;               // 长度惩罚
    int max_batch_size = 32;                   // 最大批处理大小
    bool use_vmap = false;                     // 使用词汇映射
    std::vector<std::string> target_prefix;    // 目标语言前缀 (如 ["__zh__"] for M2M100)
};

class TranslateWrapper {
public:
    TranslateWrapper();
    ~TranslateWrapper();
    
    // 加载翻译模型
    bool loadModel(const std::string& modelPath, const std::string& device = "cpu");
    
    // 加载 SentencePiece tokenizer（可选，用于 M2M100/NLLB 等模型）
    bool loadTokenizer(const std::string& tokenizerPath);
    
    // 单句翻译
    std::string translate(const std::string& text, const TranslateParams& params = TranslateParams());
    
    // 批量翻译
    std::vector<std::string> translateBatch(const std::vector<std::string>& texts, 
                                           const TranslateParams& params = TranslateParams());
    
    // 使用预先tokenized的tokens进行翻译（跳过tokenization步骤）
    std::string translateWithTokens(const std::vector<std::string>& tokens,
                                   const TranslateParams& params = TranslateParams());
    
    // 检查模型是否已加载
    bool isModelLoaded() const { return model_loaded_; }
    
    // 获取支持的设备
    static std::vector<std::string> getSupportedDevices();
    
private:
    std::unique_ptr<ctranslate2::Translator> translator_;
    std::unique_ptr<lltranslate::SentencePieceTokenizer> tokenizer_;  // SentencePiece tokenizer
    bool model_loaded_;
    bool tokenizer_loaded_;
    
    // Tokenization helpers
    std::vector<std::string> tokenize(const std::string& text);
    std::string detokenize(const std::vector<std::string>& tokens);
};

} // namespace lltranslate
