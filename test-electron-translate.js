/**
 * 测试 Electron 应用中的翻译功能
 * 模拟从转录到翻译的完整流程
 */

const { loadTranslateModel, loadTranslateTokenizer, translateText, translateBatch } = require('./llwhisper.node');
const path = require('path');

console.log('='.repeat(60));
console.log('测试 Electron 翻译功能集成');
console.log('='.repeat(60));

// 配置
const config = {
    translationModelPath: path.join(__dirname, 'native', 'model', 'm2m100-ct2'),
    translationTokenizerPath: path.join(__dirname, 'native', 'model', 'm2m100_418M', 'sentencepiece.bpe.model')
};

console.log('\n[步骤 1] 加载翻译模型和 Tokenizer');
console.log('-'.repeat(60));

try {
    const modelLoaded = loadTranslateModel(config.translationModelPath, 'cuda');
    if (!modelLoaded) {
        throw new Error('Failed to load model');
    }
    console.log('✓ 模型加载成功');
    
    const tokenizerLoaded = loadTranslateTokenizer(config.translationTokenizerPath);
    if (!tokenizerLoaded) {
        throw new Error('Failed to load tokenizer');
    }
    console.log('✓ Tokenizer 加载成功');
} catch (error) {
    console.error('✗ 初始化失败:', error.message);
    process.exit(1);
}

console.log('\n[步骤 2] 模拟转录结果');
console.log('-'.repeat(60));

// 模拟 Whisper 转录后的字幕片段（日文）
const mockSegments = [
    { id: '1', startTime: 0, endTime: 2.5, text: 'Hello, how are you?', language: 'en' },
    { id: '2', startTime: 2.5, endTime: 5.0, text: 'I am fine, thank you.', language: 'en' },
    { id: '3', startTime: 5.0, endTime: 8.0, text: 'What are you doing today?', language: 'en' },
    { id: '4', startTime: 8.0, endTime: 10.5, text: 'I am working on a project.', language: 'en' },
];

console.log(`生成了 ${mockSegments.length} 个字幕片段`);
mockSegments.forEach(seg => {
    console.log(`  [${seg.startTime}s - ${seg.endTime}s] ${seg.text}`);
});

console.log('\n[步骤 3] 单个翻译测试 (EN -> JA)');
console.log('-'.repeat(60));

const sourceLang = 'en';
const targetLang = 'ja';
const targetLangCode = `__${targetLang}__`;

console.log(`源语言: ${sourceLang}`);
console.log(`目标语言: ${targetLang} (${targetLangCode})`);

try {
    const singleText = mockSegments[0].text;
    console.log(`\n测试文本: "${singleText}"`);
    
    const singleResult = translateText(singleText, {
        target_prefix: [targetLangCode],
        beam_size: 4,
        length_penalty: 1
    });
    
    console.log(`翻译结果: "${singleResult}"`);
    console.log('✓ 单个翻译成功');
} catch (error) {
    console.error('✗ 单个翻译失败:', error.message);
}

console.log('\n[步骤 4] 批量翻译测试 (EN -> ZH)');
console.log('-'.repeat(60));

const targetLangCN = '__zh__';
console.log(`目标语言: zh (${targetLangCN})`);

try {
    const texts = mockSegments.map(seg => seg.text);
    console.log(`翻译 ${texts.length} 个文本片段...`);
    
    const results = translateBatch(texts, {
        target_prefix: [targetLangCN],
        beam_size: 4,
        max_batch_size: 32,
        length_penalty: 1
    });
    
    console.log(`\n批量翻译结果:`);
    results.forEach((translation, index) => {
        console.log(`\n[${index + 1}] 原文: ${mockSegments[index].text}`);
        console.log(`    译文: ${translation}`);
    });
    
    console.log('\n✓ 批量翻译成功');
} catch (error) {
    console.error('✗ 批量翻译失败:', error.message);
}

console.log('\n[步骤 5] 模拟 Electron IPC 处理流程');
console.log('-'.repeat(60));

// 模拟 IPC handler 的逻辑
async function simulateIpcBatchTranslate(texts, sourceLang, targetLang) {
    try {
        const targetLangCode = `__${targetLang}__`;
        console.log(`[IPC] Batch translating ${texts.length} texts (${sourceLang} -> ${targetLang})...`);
        
        const results = translateBatch(texts, {
            target_prefix: [targetLangCode],
            beam_size: 4,
            max_batch_size: 32,
            length_penalty: 1
        });
        
        console.log(`[IPC] Batch translation completed: ${results.length} results`);
        return results;
    } catch (error) {
        console.error('[IPC] Batch error:', error.message);
        return texts; // 返回原文
    }
}

(async () => {
    const texts = mockSegments.map(seg => seg.text);
    const translations = await simulateIpcBatchTranslate(texts, 'en', 'ja');
    
    console.log('\n最终字幕结果 (带翻译):');
    console.log('-'.repeat(60));
    
    const finalSegments = mockSegments.map((seg, index) => ({
        ...seg,
        translatedText: translations[index]
    }));
    
    finalSegments.forEach(seg => {
        console.log(`\n[${seg.startTime}s - ${seg.endTime}s]`);
        console.log(`  原文: ${seg.text}`);
        console.log(`  译文: ${seg.translatedText}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✓ Electron 翻译功能测试完成');
    console.log('='.repeat(60));
})();
