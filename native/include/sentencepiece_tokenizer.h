#pragma once
#include <string>
#include <vector>
#include <memory>

// Forward declaration for SentencePiece
namespace sentencepiece {
    class SentencePieceProcessor;
}

namespace lltranslate {

/**
 * @brief Wrapper for SentencePiece tokenizer
 * 
 * This class provides tokenization and detokenization using SentencePiece models.
 * Used for models like M2M100, NLLB, OPUS-MT that require subword tokenization.
 */
class SentencePieceTokenizer {
public:
    SentencePieceTokenizer();
    ~SentencePieceTokenizer();
    
    /**
     * @brief Load a SentencePiece model
     * @param model_path Path to the .spm or .model file
     * @return true if loaded successfully
     */
    bool load(const std::string& model_path);
    
    /**
     * @brief Tokenize text into subword tokens
     * @param text Input text
     * @return Vector of tokens
     */
    std::vector<std::string> encode(const std::string& text);
    
    /**
     * @brief Tokenize text into token IDs
     * @param text Input text
     * @return Vector of token IDs
     */
    std::vector<int> encodeAsIds(const std::string& text);
    
    /**
     * @brief Detokenize tokens back to text
     * @param tokens Vector of tokens
     * @return Decoded text
     */
    std::string decode(const std::vector<std::string>& tokens);
    
    /**
     * @brief Detokenize token IDs back to text
     * @param ids Vector of token IDs
     * @return Decoded text
     */
    std::string decodeIds(const std::vector<int>& ids);
    
    /**
     * @brief Check if tokenizer is loaded
     */
    bool isLoaded() const { return loaded_; }
    
private:
    std::unique_ptr<sentencepiece::SentencePieceProcessor> processor_;
    bool loaded_;
};

} // namespace lltranslate
