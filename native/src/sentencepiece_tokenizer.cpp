#include "sentencepiece_tokenizer.h"
#include <sentencepiece_processor.h>
#include <iostream>

namespace lltranslate {

SentencePieceTokenizer::SentencePieceTokenizer() 
    : processor_(std::make_unique<sentencepiece::SentencePieceProcessor>()),
      loaded_(false) {
}

SentencePieceTokenizer::~SentencePieceTokenizer() = default;

bool SentencePieceTokenizer::load(const std::string& model_path) {
    std::cout << "[SPM] Loading tokenizer from: " << model_path << std::endl;
    
    const auto status = processor_->Load(model_path);
    if (!status.ok()) {
        std::cerr << "[SPM] Failed to load tokenizer: " << status.ToString() << std::endl;
        loaded_ = false;
        return false;
    }
    
    loaded_ = true;
    std::cout << "[SPM] ✓ Tokenizer loaded successfully" << std::endl;
    std::cout << "[SPM] Vocabulary size: " << processor_->GetPieceSize() << std::endl;
    return true;
}

std::vector<std::string> SentencePieceTokenizer::encode(const std::string& text) {
    if (!loaded_) {
        std::cerr << "[SPM] Tokenizer not loaded" << std::endl;
        return {};
    }
    
    std::vector<std::string> tokens;
    const auto status = processor_->Encode(text, &tokens);
    
    if (!status.ok()) {
        std::cerr << "[SPM] Encoding failed: " << status.ToString() << std::endl;
        return {};
    }
    
    std::cout << "[SPM] Encoded \"" << text << "\" -> " << tokens.size() << " tokens" << std::endl;
    
    // Debug: print first few tokens
    if (tokens.size() > 0) {
        std::cout << "[SPM] First tokens: ";
        for (size_t i = 0; i < std::min(size_t(5), tokens.size()); i++) {
            std::cout << "\"" << tokens[i] << "\" ";
        }
        std::cout << std::endl;
    }
    
    return tokens;
}

std::vector<int> SentencePieceTokenizer::encodeAsIds(const std::string& text) {
    if (!loaded_) {
        std::cerr << "[SPM] Tokenizer not loaded" << std::endl;
        return {};
    }
    
    std::vector<int> ids;
    const auto status = processor_->Encode(text, &ids);
    
    if (!status.ok()) {
        std::cerr << "[SPM] Encoding (IDs) failed: " << status.ToString() << std::endl;
        return {};
    }
    
    std::cout << "[SPM] Encoded \"" << text << "\" -> " << ids.size() << " token IDs" << std::endl;
    
    // Debug: print first few IDs
    if (ids.size() > 0) {
        std::cout << "[SPM] First token IDs: ";
        for (size_t i = 0; i < std::min(size_t(5), ids.size()); i++) {
            std::cout << ids[i] << " ";
        }
        std::cout << std::endl;
    }
    
    return ids;
}

std::string SentencePieceTokenizer::decode(const std::vector<std::string>& tokens) {
    if (!loaded_) {
        std::cerr << "[SPM] Tokenizer not loaded" << std::endl;
        return "";
    }
    
    std::cout << "[SPM] Decoding " << tokens.size() << " tokens..." << std::endl;
    
    // Debug: print first few tokens
    if (tokens.size() > 0) {
        std::cout << "[SPM] First tokens to decode: ";
        for (size_t i = 0; i < std::min(size_t(5), tokens.size()); i++) {
            std::cout << "\"" << tokens[i] << "\" ";
        }
        std::cout << std::endl;
    }
    
    std::string text;
    std::cout << "[SPM] Calling processor_->Decode()..." << std::endl;
    const auto status = processor_->Decode(tokens, &text);
    std::cout << "[SPM] processor_->Decode() returned!" << std::endl;
    
    if (!status.ok()) {
        std::cerr << "[SPM] Decoding failed: " << status.ToString() << std::endl;
        return "";
    }
    
    std::cout << "[SPM] ✓ Decoded successfully! Result length: " << text.length() << std::endl;
    std::cout << "[SPM] Decoded text: " << text << std::endl;
    
    return text;
}

std::string SentencePieceTokenizer::decodeIds(const std::vector<int>& ids) {
    if (!loaded_) {
        std::cerr << "[SPM] Tokenizer not loaded" << std::endl;
        return "";
    }
    
    std::string text;
    const auto status = processor_->Decode(ids, &text);
    
    if (!status.ok()) {
        std::cerr << "[SPM] Decoding (IDs) failed: " << status.ToString() << std::endl;
        return "";
    }
    
    return text;
}

} // namespace lltranslate
