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
