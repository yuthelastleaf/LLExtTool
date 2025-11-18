#include <iostream>
#include <vector>
#include <string>
#include <ctranslate2/translator.h>

int main() {
    try {
        const std::string model_path = "f:\\GitProject\\LLExtTool\\native\\model\\m2m100-ct2";
        
        std::cout << "Loading M2M100 model from: " << model_path << std::endl;
        
        // Create Translator using our working approach
        ctranslate2::Translator translator(
            model_path,
            ctranslate2::Device::CUDA,
            ctranslate2::ComputeType::DEFAULT
        );
        
        std::cout << "Model loaded successfully!" << std::endl;
        
        // Test 1: Hello (English to Japanese)
        // M2M100 format: source tokens + </s> + target_language
        std::cout << "\n=== Test 1: Hello World (EN -> JA) ===" << std::endl;
        std::vector<std::vector<std::string>> batch1 = {
            {"\xE2\x96\x81H", "ello", "\xE2\x96\x81", "world", "</s>"}  // UTF-8: ▁Hello ▁world </s>
        };
        std::vector<std::vector<std::string>> target_prefix1 = {
            {"__ja__"}  // Target: Japanese
        };
        
        std::cout << "Input tokens: [" << batch1[0].size() << " tokens]" << std::endl;
        std::cout << "Target language: __ja__" << std::endl;
        
        ctranslate2::TranslationOptions options;
        options.beam_size = 4;
        
        auto translation1 = translator.translate_batch(batch1, target_prefix1, options);
        
        std::cout << "Output tokens: ";
        for (const auto& token : translation1[0].output()) {
            std::cout << token << ' ';
        }
        std::cout << std::endl;
        
        // Test 2: Simple greeting
        std::cout << "\n=== Test 2: Good morning (EN -> JA) ===" << std::endl;
        std::vector<std::vector<std::string>> batch2 = {
            {"\xE2\x96\x81", "Good", "\xE2\x96\x81", "morning", "</s>"}
        };
        std::vector<std::vector<std::string>> target_prefix2 = {
            {"__ja__"}
        };
        
        std::cout << "Input tokens: [" << batch2[0].size() << " tokens]" << std::endl;
        std::cout << "Target language: __ja__" << std::endl;
        
        auto translation2 = translator.translate_batch(batch2, target_prefix2, options);
        
        std::cout << "Output tokens: ";
        for (const auto& token : translation2[0].output()) {
            std::cout << token << ' ';
        }
        std::cout << std::endl;
        
        std::cout << "\n=== All tests completed successfully! ===" << std::endl;
        
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}
