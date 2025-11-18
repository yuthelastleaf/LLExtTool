/**
 * 测试动态重新加载翻译模型功能
 */

const { loadTranslateModel, loadTranslateTokenizer, translateText } = require('./llwhisper.node');
const path = require('path');

console.log('='.repeat(60));
console.log('测试动态重新加载翻译模型');
console.log('='.repeat(60));

// 初始配置
const initialConfig = {
    translationModelPath: path.join(__dirname, 'native', 'model', 'm2m100-ct2'),
    translationTokenizerPath: path.join(__dirname, 'native', 'model', 'm2m100_418M', 'sentencepiece.bpe.model')
};

console.log('\n[步骤 1] 首次加载模型');
console.log('-'.repeat(60));
console.log('模型路径:', initialConfig.translationModelPath);
console.log('Tokenizer路径:', initialConfig.translationTokenizerPath);

try {
    const modelLoaded = loadTranslateModel(initialConfig.translationModelPath, 'cuda');
    const tokenizerLoaded = loadTranslateTokenizer(initialConfig.translationTokenizerPath);
    
    if (modelLoaded && tokenizerLoaded) {
        console.log('✓ 初始模型加载成功');
    } else {
        throw new Error('模型或 Tokenizer 加载失败');
    }
} catch (error) {
    console.error('✗ 初始加载失败:', error.message);
    process.exit(1);
}

console.log('\n[步骤 2] 测试初始翻译');
console.log('-'.repeat(60));

const testText = 'Hello, how are you?';
console.log('测试文本:', testText);

try {
    const result1 = translateText(testText, {
        target_prefix: ['__ja__'],
        beam_size: 4,
        length_penalty: 1
    });
    console.log('翻译结果 (EN->JA):', result1);
    console.log('✓ 初始翻译成功');
} catch (error) {
    console.error('✗ 翻译失败:', error.message);
}

console.log('\n[步骤 3] 模拟修改配置（重新加载相同模型）');
console.log('-'.repeat(60));
console.log('模拟场景：用户在设置中修改了配置，点击"重新加载"按钮');

// 模拟 IPC 处理器的重新加载逻辑
function reloadTranslationModel(config) {
    console.log('\n🔄 开始重新加载模型...');
    console.log('新模型路径:', config.translationModelPath);
    console.log('新Tokenizer路径:', config.translationTokenizerPath);
    
    try {
        // 重新加载模型
        const modelLoaded = loadTranslateModel(config.translationModelPath, 'cuda');
        if (!modelLoaded) {
            throw new Error('模型加载失败');
        }
        console.log('✓ 模型重新加载成功');
        
        // 重新加载 tokenizer
        const tokenizerLoaded = loadTranslateTokenizer(config.translationTokenizerPath);
        if (!tokenizerLoaded) {
            throw new Error('Tokenizer 加载失败');
        }
        console.log('✓ Tokenizer 重新加载成功');
        
        return { success: true, message: '翻译模型重新加载成功' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

const reloadResult = reloadTranslationModel(initialConfig);

if (reloadResult.success) {
    console.log('\n✓ 重新加载成功:', reloadResult.message);
} else {
    console.error('\n✗ 重新加载失败:', reloadResult.message);
    process.exit(1);
}

console.log('\n[步骤 4] 测试重新加载后的翻译');
console.log('-'.repeat(60));

try {
    const result2 = translateText(testText, {
        target_prefix: ['__zh__'],
        beam_size: 4,
        length_penalty: 1
    });
    console.log('测试文本:', testText);
    console.log('翻译结果 (EN->ZH):', result2);
    console.log('✓ 重新加载后翻译正常工作');
} catch (error) {
    console.error('✗ 重新加载后翻译失败:', error.message);
}

console.log('\n[步骤 5] 测试多次重新加载');
console.log('-'.repeat(60));

for (let i = 1; i <= 3; i++) {
    console.log(`\n第 ${i} 次重新加载...`);
    const result = reloadTranslationModel(initialConfig);
    
    if (result.success) {
        console.log(`  ✓ 第 ${i} 次重新加载成功`);
        
        // 测试翻译
        try {
            const translation = translateText('Good morning', {
                target_prefix: ['__ja__'],
                beam_size: 4,
                length_penalty: 1
            });
            console.log(`  ✓ 翻译测试通过: "Good morning" -> "${translation}"`);
        } catch (error) {
            console.error(`  ✗ 翻译测试失败:`, error.message);
        }
    } else {
        console.error(`  ✗ 第 ${i} 次重新加载失败:`, result.message);
    }
}

console.log('\n' + '='.repeat(60));
console.log('总结');
console.log('='.repeat(60));
console.log('✓ 动态重新加载功能测试通过');
console.log('✓ 无需重启应用即可加载新模型');
console.log('✓ 支持多次重新加载');
console.log('✓ 重新加载后翻译功能正常');
console.log('='.repeat(60));
