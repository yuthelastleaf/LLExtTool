#include "../include/translate_wrapper.h"
#include "../include/sentencepiece_tokenizer.h"
#include <ctranslate2/translator.h>
#include <iostream>
#include <sstream>
#include <algorithm>

namespace lltranslate {

TranslateWrapper::TranslateWrapper() 
    : model_loaded_(false), 
      tokenizer_loaded_(false),
      tokenizer_(std::make_unique<SentencePieceTokenizer>()) {}

TranslateWrapper::~TranslateWrapper() {
    translator_.reset();
    tokenizer_.reset();
}

bool TranslateWrapper::loadModel(const std::string& modelPath, const std::string& device) {
    try {
        std::cout << "[Translate] Loading model from: " << modelPath << std::endl;
        std::cout << "[Translate] Using device: " << device << std::endl;
        
        // 将字符串转换为 Device 枚举
        ctranslate2::Device dev = ctranslate2::str_to_device(device);
        
        // 创建 Translator 实例
        translator_ = std::make_unique<ctranslate2::Translator>(
            modelPath,
            dev,
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

bool TranslateWrapper::loadTokenizer(const std::string& tokenizerPath) {
    std::cout << "[Translate] Loading tokenizer..." << std::endl;
    
    if (!tokenizer_) {
        tokenizer_ = std::make_unique<SentencePieceTokenizer>();
    }
    
    tokenizer_loaded_ = tokenizer_->load(tokenizerPath);
    return tokenizer_loaded_;
}

std::vector<std::string> TranslateWrapper::tokenize(const std::string& text) {
    std::vector<std::string> tokens;
    
    // Tokenize the text with SentencePiece directly
    // Language tags are passed via target_prefix parameter, not in input text
    if (tokenizer_loaded_ && tokenizer_ && !text.empty()) {
        std::vector<std::string> text_tokens = tokenizer_->encode(text);
        tokens.insert(tokens.end(), text_tokens.begin(), text_tokens.end());
    } else if (!text.empty()) {
        // Fallback: add entire text as single token
        tokens.push_back(text);
    }
    
    // Add </s> end-of-sequence token (required for M2M100, NLLB and most seq2seq models)
    tokens.push_back("</s>");
    
    return tokens;
}

std::string TranslateWrapper::detokenize(const std::vector<std::string>& tokens) {
    std::cout << "[Detokenize] Input tokens count: " << tokens.size() << std::endl;
    
    // Filter out language tags from both M2M100 and NLLB models
    std::vector<std::string> filtered_tokens;
    for (const auto& token : tokens) {
        // Skip M2M100 language tags: __ja__, __zh__, __en__
        if (token.length() > 4 && token[0] == '_' && token[1] == '_' && 
            token[token.length()-1] == '_' && token[token.length()-2] == '_') {
            std::cout << "[Detokenize] Skipping M2M100 language tag: " << token << std::endl;
            continue;
        }
        
        // Skip NLLB-200 language tags: jpn_Jpan, zho_Hans, eng_Latn, etc.
        // Format: xxx_Xxxx (3 letters + underscore + script code)
        if (token.length() >= 7 && token.length() <= 10) {
            size_t underscore_pos = token.find('_');
            if (underscore_pos == 3 && underscore_pos != std::string::npos) {
                // Check if it's a valid language code pattern (all lowercase before underscore)
                bool is_lang_code = true;
                for (size_t i = 0; i < 3; ++i) {
                    if (!std::islower(static_cast<unsigned char>(token[i]))) {
                        is_lang_code = false;
                        break;
                    }
                }
                if (is_lang_code) {
                    std::cout << "[Detokenize] Skipping NLLB language tag: " << token << std::endl;
                    continue;
                }
            }
        }
        
        filtered_tokens.push_back(token);
    }
    
    std::cout << "[Detokenize] Filtered tokens count: " << filtered_tokens.size() << std::endl;
    
    // If SentencePiece tokenizer is loaded, use it for proper detokenization
    if (tokenizer_loaded_ && tokenizer_) {
        std::cout << "[Detokenize] Using SentencePiece decoder..." << std::endl;
        if (!filtered_tokens.empty()) {
            std::string result = tokenizer_->decode(filtered_tokens);
            std::cout << "[Detokenize] SentencePiece decode successful! Length: " << result.length() << std::endl;
            return result;
        }
        std::cout << "[Detokenize] No tokens to decode!" << std::endl;
        return "";
    }
    
    // Fallback: simple space-join
    std::cout << "[Detokenize] Using fallback space-join..." << std::endl;
    std::string result;
    for (size_t i = 0; i < filtered_tokens.size(); ++i) {
        if (i > 0) result += " ";
        result += filtered_tokens[i];
    }
    return result;
}

std::string TranslateWrapper::translate(const std::string& text, const TranslateParams& params) {
    if (!model_loaded_) {
        throw std::runtime_error("Model not loaded");
    }
    
    try {
        std::cout << "[Translate] Starting translation..." << std::endl;
        std::cout << "[Translate] Input text: " << text << std::endl;
        
        // Tokenize input
        std::vector<std::string> tokens = tokenize(text);
        std::cout << "[Translate] Tokens count: " << tokens.size() << std::endl;
        
        // Debug: print first few tokens
        if (tokens.size() > 0) {
            std::cout << "[Translate] First tokens: ";
            for (size_t i = 0; i < std::min(size_t(5), tokens.size()); i++) {
                std::cout << "\"" << tokens[i] << "\" ";
            }
            std::cout << std::endl;
        }
        
        // 翻译选项
        ctranslate2::TranslationOptions options;
        options.beam_size = params.beam_size;
        options.length_penalty = params.length_penalty;
        options.use_vmap = params.use_vmap;
        
        std::cout << "[Translate] Beam size: " << options.beam_size << std::endl;
        std::cout << "[Translate] Target prefix count: " << params.target_prefix.size() << std::endl;
        
        // 执行翻译
        std::vector<ctranslate2::TranslationResult> results;
        if (!params.target_prefix.empty()) {
            std::cout << "[Translate] Using target_prefix: ";
            for (const auto& prefix : params.target_prefix) {
                std::cout << prefix << " ";
            }
            std::cout << std::endl;
            std::vector<std::vector<std::string>> target_prefix_batch = {params.target_prefix};
            
            std::cout << "[Translate] Calling translate_batch..." << std::endl;
            results = translator_->translate_batch({tokens}, target_prefix_batch, options);
            std::cout << "[Translate] translate_batch returned successfully!" << std::endl;
        } else {
            std::cout << "[Translate] No target_prefix" << std::endl;
            results = translator_->translate_batch({tokens}, options);
        }
        
        std::cout << "[Translate] Results count: " << results.size() << std::endl;
        
        // 提取结果
        if (!results.empty()) {
            std::cout << "[Translate] Hypotheses count: " << results[0].hypotheses.size() << std::endl;
            if (!results[0].hypotheses.empty()) {
                std::cout << "[Translate] Output tokens count: " << results[0].hypotheses[0].size() << std::endl;
                
                // 打印前几个输出 token
                std::cout << "[Translate] First output tokens: ";
                for (size_t i = 0; i < std::min(size_t(5), results[0].hypotheses[0].size()); i++) {
                    std::cout << "\"" << results[0].hypotheses[0][i] << "\" ";
                }
                std::cout << std::endl;
                
                std::cout << "[Translate] Calling detokenize..." << std::endl;
                std::string translation = detokenize(results[0].hypotheses[0]);
                std::cout << "[Translate] detokenize returned successfully!" << std::endl;
                std::cout << "[Translate] Translation: " << translation << std::endl;
                return translation;
            }
        }
        
        std::cout << "[Translate] No results!" << std::endl;
        return "";
        
    } catch (const std::exception& e) {
        std::cout << "[Translate] Exception: " << e.what() << std::endl;
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
        options.use_vmap = params.use_vmap;
        
        // 批量翻译 (max_batch_size 作为 translate_batch 的参数)
        std::vector<ctranslate2::TranslationResult> results;
        if (!params.target_prefix.empty()) {
            // Use target_prefix for each batch item
            std::vector<std::vector<std::string>> target_prefix_batch(batch_tokens.size(), params.target_prefix);
            results = translator_->translate_batch(batch_tokens, target_prefix_batch, options, params.max_batch_size);
        } else {
            results = translator_->translate_batch(batch_tokens, options, params.max_batch_size);
        }
        
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

std::string TranslateWrapper::translateWithTokens(
    const std::vector<std::string>& tokens,
    const TranslateParams& params) {
    
    if (!model_loaded_) {
        throw std::runtime_error("Model not loaded");
    }
    
    std::cout << "[Translate] translateWithTokens called with " << tokens.size() << " tokens" << std::endl;
    
    // Debug: print first few tokens
    if (tokens.size() > 0) {
        std::cout << "[Translate] First tokens: ";
        for (size_t i = 0; i < std::min(size_t(5), tokens.size()); i++) {
            std::cout << "\"" << tokens[i] << "\" ";
        }
        std::cout << std::endl;
    }
    
    try {
        // 翻译选项
        ctranslate2::TranslationOptions options;
        options.beam_size = params.beam_size;
        options.length_penalty = params.length_penalty;
        options.use_vmap = params.use_vmap;
        
        std::cout << "[Translate] Calling translate_batch with pre-tokenized input..." << std::endl;
        
        // 直接使用传入的tokens进行翻译
        std::vector<ctranslate2::TranslationResult> results;
        if (!params.target_prefix.empty()) {
            std::vector<std::vector<std::string>> target_prefix_batch = {params.target_prefix};
            results = translator_->translate_batch({tokens}, target_prefix_batch, options);
        } else {
            results = translator_->translate_batch({tokens}, options);
        }
        
        std::cout << "[Translate] translate_batch returned " << results.size() << " results" << std::endl;
        
        if (!results.empty() && !results[0].hypotheses.empty()) {
            const auto& output_tokens = results[0].hypotheses[0];
            std::cout << "[Translate] Output has " << output_tokens.size() << " tokens" << std::endl;
            
            // 直接拼接tokens（不需要detokenize，因为CTranslate2已经返回了token strings）
            std::string translation;
            for (const auto& token : output_tokens) {
                translation += token;
            }
            
            std::cout << "[Translate] Translation: " << translation << std::endl;
            return translation;
        }
        
        std::cout << "[Translate] No results!" << std::endl;
        return "";
        
    } catch (const std::exception& e) {
        std::cout << "[Translate] Exception: " << e.what() << std::endl;
        throw std::runtime_error(std::string("Translation failed: ") + e.what());
    }
}

std::vector<std::string> TranslateWrapper::getSupportedDevices() {
    return {"cpu", "cuda", "auto"};
}

} // namespace lltranslate
