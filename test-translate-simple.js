const path = require('path');
const llwhisper = require('./build/Release/llwhisper.node');

console.log('\n=== 简单翻译测试 ===\n');

const modelPath = path.join(__dirname, 'native', 'model', 'm2m100-ct2');
console.log('模型路径:', modelPath);

try {
    // 加载模型（GPU）
    console.log('\n1. 加载模型...');
    const loaded = llwhisper.loadTranslateModel(modelPath, 'cuda');
    
    if (!loaded) {
        console.log('❌ 模型加载失败');
        process.exit(1);
    }
    
    console.log('✓ 模型加载成功');
    
    // 测试不同的输入格式
    console.log('\n2. 测试不同输入格式:\n');
    
    const tests = [
        {
            name: '纯语言标记',
            text: '__ja__',
            target: '__zh__'
        },
        {
            name: '单个英文单词',
            text: '__en__ hello',
            target: '__zh__'
        },
        {
            name: '数字',
            text: '__en__ 123',
            target: '__zh__'
        }
    ];
    
    for (const test of tests) {
        console.log(`测试: ${test.name}`);
        console.log(`输入: "${test.text}"`);
        
        try {
            const result = llwhisper.translateText(test.text, {
                target_prefix: [test.target],
                beam_size: 1  // 使用 beam_size=1 加快速度
            });
            
            console.log(`输出: "${result}"`);
            console.log(`包含 <unk>: ${result.includes('<unk>') ? '是' : '否'}`);
            console.log('');
            
        } catch (err) {
            console.log(`错误: ${err.message}\n`);
        }
    }
    
} catch (err) {
    console.log('❌ 错误:', err.message);
    console.log(err.stack);
}
