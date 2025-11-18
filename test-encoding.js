const llwhisper = require('./build/Release/llwhisper.node');
const path = require('path');

console.log('=== 测试字符编码 ===\n');

// 测试字符串
const testStrings = [
    '你好',
    '今天',
    'Hello',
    '日本語'
];

console.log('Node.js 环境:');
testStrings.forEach(str => {
    console.log(`  字符串: "${str}"`);
    console.log(`  长度: ${str.length}`);
    console.log(`  Buffer (UTF-8): ${Buffer.from(str, 'utf8').toString('hex')}`);
    console.log('');
});

// 加载模型和 tokenizer
const modelPath = path.join(__dirname, 'native/model/opus-mt-tc-big-zh-ja-ct2');
const tokenizerPath = path.join(__dirname, 'native/model/opus-mt-tc-big-zh-ja/source.spm');

try {
    console.log('\n加载模型...');
    llwhisper.loadTranslateModel(modelPath, 'cuda');
    
    console.log('加载 tokenizer...');
    llwhisper.loadTranslateTokenizer(tokenizerPath);
    
    console.log('\n测试翻译（观察 C++ 端的日志）:\n');
    
    // 测试一个简单的中文字符串
    const testText = '你好';
    console.log(`输入: "${testText}"`);
    console.log(`Buffer: ${Buffer.from(testText, 'utf8').toString('hex')}`);
    console.log('');
    
    const result = llwhisper.translateText(testText, { beam_size: 1 });
    
    console.log(`\n输出: "${result}"`);
    console.log(`Buffer: ${Buffer.from(result, 'utf8').toString('hex')}`);
    
} catch (err) {
    console.error('错误:', err.message);
}
