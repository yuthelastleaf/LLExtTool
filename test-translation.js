const llwhisper = require('./build/Release/llwhisper.node');
const path = require('path');

console.log('=== Testing Translation with SentencePiece Tokenizer ===\n');

// 模型和 Tokenizer 路径
const modelPath = path.join(__dirname, 'native/model/m2m100-ct2');
const tokenizerPath = path.join(__dirname, 'native/model/m2m100_418M/sentencepiece.bpe.model');

console.log('Model path:', modelPath);
console.log('Tokenizer path:', tokenizerPath);
console.log('');

try {
    // 1. 加载翻译模型
    console.log('Loading translation model on GPU...');
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
    console.log('=== Translation Tests ===\n');

    // 测试 1: 日文 → 中文
    console.log('Test 1: Japanese → Chinese');
    const japaneseText = '__ja__ こんにちは、世界！';  // M2M100 需要在输入前添加源语言标记
    console.log('Input (Japanese):', japaneseText);
    
    const chineseResult = llwhisper.translateText(japaneseText, {
        beam_size: 4,
        target_prefix: ['__zh__']  // 目标语言标记
    });
    console.log('Output (Chinese):', chineseResult);
    console.log('');

    // 测试 2: 中文 → 日文
    console.log('Test 2: Chinese → Japanese');
    const chineseText = '__zh__ 今天天气真好。';  // 添加源语言标记
    console.log('Input (Chinese):', chineseText);
    
    const japaneseResult = llwhisper.translateText(chineseText, {
        beam_size: 4,
        target_prefix: ['__ja__']  // 目标语言标记
    });
    console.log('Output (Japanese):', japaneseResult);
    console.log('');

    // 测试 3: 英文 → 中文
    console.log('Test 3: English → Chinese');
    const englishText = '__en__ Hello, how are you today?';  // 添加源语言标记
    console.log('Input (English):', englishText);
    
    const chineseResult2 = llwhisper.translateText(englishText, {
        beam_size: 4,
        target_prefix: ['__zh__']  // 目标语言标记
    });
    console.log('Output (Chinese):', chineseResult2);
    console.log('');

    // 测试 4: 批量翻译
    console.log('Test 4: Batch Translation (Japanese → Chinese)');
    const batchTexts = [
        '__ja__ おはようございます。',
        '__ja__ ありがとうございます。',
        '__ja__ 美しい景色ですね。'
    ];
    console.log('Input texts:', batchTexts);
    
    const batchResults = llwhisper.translateBatch(batchTexts, {
        beam_size: 4,
        target_prefix: ['__zh__']
    });
    console.log('Output texts:', batchResults);
    console.log('');

    console.log('=== All tests completed successfully! ===');

} catch (error) {
    console.error('Error during translation:', error);
    process.exit(1);
}
