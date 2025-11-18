/**
 * 测试翻译模型配置和加载
 * 
 * 目的：
 * 1. 验证配置文件正确保存模型目录路径（而不是 model.bin 文件路径）
 * 2. 验证程序启动时能正确加载模型和tokenizer
 * 3. 测试翻译功能是否正常工作
 */

const { loadTranslateModel, loadTranslateTokenizer, translateText } = require('./llwhisper.node');
const path = require('path');
const fs = require('fs');

console.log('='.repeat(60));
console.log('测试翻译模型配置和加载');
console.log('='.repeat(60));

// 模拟配置文件中保存的路径（应该是目录，不是文件）
const config = {
    translationModelPath: path.join(__dirname, 'native', 'model', 'm2m100-ct2'),
    translationTokenizerPath: path.join(__dirname, 'native', 'model', 'm2m100_418M', 'sentencepiece.bpe.model')
};

console.log('\n[步骤 1] 检查配置路径');
console.log('-'.repeat(60));
console.log('模型目录:', config.translationModelPath);
console.log('Tokenizer路径:', config.translationTokenizerPath);

// 验证路径是目录还是文件
const modelPathStats = fs.existsSync(config.translationModelPath) ? fs.statSync(config.translationModelPath) : null;
const tokenizerPathStats = fs.existsSync(config.translationTokenizerPath) ? fs.statSync(config.translationTokenizerPath) : null;

console.log('\n模型路径类型:', modelPathStats ? (modelPathStats.isDirectory() ? '目录 ✓' : '文件 ✗') : '不存在 ✗');
console.log('Tokenizer路径类型:', tokenizerPathStats ? (tokenizerPathStats.isFile() ? '文件 ✓' : '目录 ✗') : '不存在 ✗');

// 检查模型目录中的必需文件
if (modelPathStats && modelPathStats.isDirectory()) {
    const modelBinPath = path.join(config.translationModelPath, 'model.bin');
    const configJsonPath = path.join(config.translationModelPath, 'config.json');
    
    console.log('\n检查模型目录内容:');
    console.log('  - model.bin:', fs.existsSync(modelBinPath) ? '✓' : '✗');
    console.log('  - config.json:', fs.existsSync(configJsonPath) ? '✓' : '✗');
}

console.log('\n[步骤 2] 加载模型');
console.log('-'.repeat(60));

try {
    // 加载模型（传入目录路径）
    console.log('调用 loadTranslateModel(modelDir, device)...');
    const modelLoaded = loadTranslateModel(config.translationModelPath, 'cuda');
    
    if (modelLoaded) {
        console.log('✓ 模型加载成功');
    } else {
        console.error('✗ 模型加载失败（返回 false）');
        process.exit(1);
    }
} catch (error) {
    console.error('✗ 模型加载异常:', error.message);
    process.exit(1);
}

console.log('\n[步骤 3] 加载 Tokenizer');
console.log('-'.repeat(60));

try {
    // 加载tokenizer（传入文件路径）
    console.log('调用 loadTranslateTokenizer(tokenizerPath)...');
    const tokenizerLoaded = loadTranslateTokenizer(config.translationTokenizerPath);
    
    if (tokenizerLoaded) {
        console.log('✓ Tokenizer加载成功');
    } else {
        console.error('✗ Tokenizer加载失败（返回 false）');
        process.exit(1);
    }
} catch (error) {
    console.error('✗ Tokenizer加载异常:', error.message);
    process.exit(1);
}

console.log('\n[步骤 4] 测试翻译功能');
console.log('-'.repeat(60));

// 测试用例（正确使用 M2M100 的 target_prefix 参数）
const testCases = [
    { 
        text: 'Hello world', 
        targetLang: '__ja__',
        desc: '英文 → 日文' 
    },
    { 
        text: 'Hello world', 
        targetLang: '__zh__',
        desc: '英文 → 中文' 
    },
    { 
        text: 'Good morning', 
        targetLang: '__ja__',
        desc: '英文 → 日文' 
    },
    { 
        text: 'Thank you very much', 
        targetLang: '__zh__',
        desc: '英文 → 中文' 
    },
];

for (const testCase of testCases) {
    console.log(`\n测试: ${testCase.desc}`);
    console.log(`输入: "${testCase.text}"`);
    console.log(`目标语言: ${testCase.targetLang}`);
    
    try {
        // 使用 target_prefix 参数指定目标语言
        const result = translateText(testCase.text, {
            target_prefix: [testCase.targetLang],
            beam_size: 4,
            length_penalty: 1.0
        });
        console.log(`输出: "${result}"`);
        
        if (result && result.length > 0) {
            console.log('✓ 翻译成功');
        } else {
            console.log('✗ 翻译结果为空');
        }
    } catch (error) {
        console.error('✗ 翻译异常:', error.message);
    }
}

console.log('\n' + '='.repeat(60));
console.log('测试完成');
console.log('='.repeat(60));
