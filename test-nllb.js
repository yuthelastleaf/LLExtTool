const llwhisper = require('./build/Release/llwhisper.node');
const path = require('path');

console.log('=== Testing NLLB-200 Translation ===\n');

// NLLB 模型路径 (如果你有的话，否则跳过)
const modelPath = path.join(__dirname, 'native/model/nllb-200-distilled-600M-ct2');
const tokenizerPath = path.join(__dirname, 'native/model/nllb-200-distilled-600M/sentencepiece.model');

console.log('Model path:', modelPath);
console.log('Tokenizer path:', tokenizerPath);
console.log('');

const fs = require('fs');
if (!fs.existsSync(modelPath)) {
    console.log('⚠️  NLLB 模型未找到，请先转换模型:');
    console.log('');
    console.log('pip install ctranslate2 transformers sentencepiece');
    console.log('');
    console.log('ct2-transformers-converter \\');
    console.log('  --model facebook/nllb-200-distilled-600M \\');
    console.log('  --output_dir native/model/nllb-200-distilled-600M-ct2 \\');
    console.log('  --quantization float16');
    console.log('');
    console.log('或者使用 M2M100 模型测试...');
    process.exit(0);
}

try {
    // 1. 加载翻译模型
    console.log('Loading NLLB-200 model on GPU...');
    const loaded = llwhisper.loadTranslateModel(modelPath, 'cuda');
    if (!loaded) {
        console.error('Failed to load translation model');
        process.exit(1);
    }
    console.log('✓ Model loaded successfully\n');

    // 2. 加载 SentencePiece tokenizer
    console.log('Loading SentencePiece tokenizer...');
    const tokenizerLoaded = llwhisper.loadTranslateTokenizer(tokenizerPath);
    if (!tokenizerLoaded) {
        console.error('Failed to load tokenizer');
        process.exit(1);
    }
    console.log('✓ Tokenizer loaded successfully\n');

    // 3. 测试翻译
    console.log('=== NLLB Translation Tests ===\n');

    // 测试 1: 日文 → 中文
    console.log('Test 1: Japanese → Chinese (Simplified)');
    const japaneseText = 'こんにちは、世界！';  // 纯文本，无语言标签
    console.log('Input (Japanese):', japaneseText);
    
    const chineseResult = llwhisper.translateText(japaneseText, {
        beam_size: 4,
        target_prefix: ['zho_Hans']  // NLLB Flores-200 语言代码
    });
    console.log('Output (Chinese):', chineseResult);
    console.log('');

    // 测试 2: 英文 → 中文
    console.log('Test 2: English → Chinese (Simplified)');
    const englishText = 'Hello, how are you today?';
    console.log('Input (English):', englishText);
    
    const chineseResult2 = llwhisper.translateText(englishText, {
        beam_size: 4,
        target_prefix: ['zho_Hans']
    });
    console.log('Output (Chinese):', chineseResult2);
    console.log('');

    // 测试 3: 日文 → 英文
    console.log('Test 3: Japanese → English');
    const japaneseText2 = '今日は良い天気ですね。';
    console.log('Input (Japanese):', japaneseText2);
    
    const englishResult = llwhisper.translateText(japaneseText2, {
        beam_size: 4,
        target_prefix: ['eng_Latn']  // NLLB: 英语拉丁字母
    });
    console.log('Output (English):', englishResult);
    console.log('');

    // 测试 4: 批量翻译
    console.log('Test 4: Batch Translation (Japanese → Chinese)');
    const batchTexts = [
        'おはようございます。',
        'ありがとうございます。',
        '美しい景色ですね。'
    ];
    console.log('Input texts:', batchTexts);
    
    const batchResults = llwhisper.translateBatch(batchTexts, {
        beam_size: 4,
        target_prefix: ['zho_Hans']
    });
    console.log('Output texts:', batchResults);
    console.log('');

    console.log('=== All NLLB tests completed successfully! ===');
    console.log('');
    console.log('✓ 修复说明:');
    console.log('  1. tokenize() 不再尝试解析 __ja__ 这样的前缀');
    console.log('  2. 语言标签只通过 target_prefix 参数传递');
    console.log('  3. detokenize() 可以过滤 NLLB 的 xxx_Xxxx 格式语言标签');
    console.log('');
    console.log('NLLB Flores-200 语言代码:');
    console.log('  日语:    jpn_Jpan');
    console.log('  中文简:  zho_Hans');
    console.log('  中文繁:  zho_Hant');
    console.log('  英语:    eng_Latn');
    console.log('  韩语:    kor_Hang');
    console.log('  法语:    fra_Latn');
    console.log('  德语:    deu_Latn');
    console.log('  西班牙语: spa_Latn');

} catch (error) {
    console.error('Error during translation:', error);
    process.exit(1);
}
