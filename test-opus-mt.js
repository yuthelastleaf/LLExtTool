const path = require('path');
const llwhisper = require('./build/Release/llwhisper.node');

console.log('\n=== 测试 OPUS-MT 模型 (带 SentencePiece) ===\n');

const modelPath = path.join(__dirname, 'native', 'model', 'opus-mt-tc-big-zh-ja-ct2');
const sourceTokenizerPath = path.join(__dirname, 'native', 'model', 'opus-mt-tc-big-zh-ja', 'source.spm');

console.log('模型路径:', modelPath);
console.log('Tokenizer 路径:', sourceTokenizerPath);

try {
    console.log('\n1. 加载 OPUS-MT 模型...');
    const loaded = llwhisper.loadTranslateModel(modelPath, 'cuda');
    
    if (!loaded) {
        console.log('❌ 模型加载失败');
        process.exit(1);
    }
    
    console.log('✓ 模型加载成功');
    
    console.log('\n2. 加载 SentencePiece Tokenizer...');
    const tokenizerLoaded = llwhisper.loadTranslateTokenizer(sourceTokenizerPath);
    
    if (!tokenizerLoaded) {
        console.log('❌ Tokenizer 加载失败');
        process.exit(1);
    }
    
    console.log('✓ Tokenizer 加载成功');
    
    console.log('\n3. 测试翻译 (中文 → 日文):\n');
    
    // OPUS-MT: 中文 → 日文
    const tests = [
        { text: '你好', desc: '问候' },
        { text: '今天天气很好', desc: '天气' },
        { text: '谢谢你的帮助', desc: '感谢' },
        { text: '我喜欢学习日语', desc: '爱好' },
        { text: '这是一个美丽的地方', desc: '描述' }
    ];
    
    for (const { text, desc } of tests) {
        console.log(`[${desc}] 输入: "${text}"`);
        
        try {
            const result = llwhisper.translateText(text, {
                beam_size: 5,
                length_penalty: 1.0
            });
            
            console.log(`[${desc}] 输出: "${result}"`);
            console.log('');
            
        } catch (err) {
            console.log(`[${desc}] 错误: ${err.message}\n`);
        }
    }
    
    // 批量翻译测试
    console.log('\n4. 批量翻译测试:\n');
    const batchTexts = ['早上好', '晚安', '再见'];
    console.log('输入:', batchTexts);
    
    try {
        const batchResults = llwhisper.translateBatch(batchTexts, {
            beam_size: 5,
            length_penalty: 1.0
        });
        console.log('输出:', batchResults);
    } catch (err) {
        console.log('批量翻译错误:', err.message);
    }
    
} catch (err) {
    console.log('❌ 错误:', err.message);
}
