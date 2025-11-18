/**
 * 测试 CTranslate2 翻译模块加载
 */

const path = require('path');

console.log('\n=== 测试翻译模块加载 ===\n');

// 1. 检查 CTranslate2 文件
console.log('1. 检查 CTranslate2 文件:');
const ctDir = path.join(__dirname, 'native', 'ctranslate2');
const fs = require('fs');

const requiredFiles = [
    { path: path.join(ctDir, 'include', 'ctranslate2', 'translator.h'), name: 'translator.h' },
    { path: path.join(ctDir, 'lib', 'ctranslate2.lib'), name: 'ctranslate2.lib' },
    { path: path.join(ctDir, 'bin', 'ctranslate2.dll'), name: 'ctranslate2.dll' }
];

let allFilesExist = true;
for (const file of requiredFiles) {
    const exists = fs.existsSync(file.path);
    console.log(`  ${exists ? '✓' : '✗'} ${file.name}: ${exists ? '存在' : '不存在'}`);
    if (!exists) {
        allFilesExist = false;
        console.log(`     路径: ${file.path}`);
    }
}

if (!allFilesExist) {
    console.log('\n✗ CTranslate2 文件不完整');
    console.log('\n请运行以下命令安装:');
    console.log('  node scripts/setup-ctranslate2.js');
    console.log('\n或者手动下载并解压到 native/ctranslate2/ 目录');
    process.exit(1);
}

console.log('\n2. 加载 llwhisper.node 模块:');
try {
    const llwhisper = require('./build/Release/llwhisper.node');
    console.log('  ✓ llwhisper.node 加载成功');
    
    // 检查翻译函数
    console.log('\n3. 检查翻译函数:');
    const translateFunctions = [
        'loadTranslateModel',
        'translateText',
        'translateBatch'
    ];
    
    for (const func of translateFunctions) {
        const exists = typeof llwhisper[func] === 'function';
        console.log(`  ${exists ? '✓' : '✗'} ${func}: ${exists ? '可用' : '不可用'}`);
    }
    
    // 测试加载模型（需要模型文件）
    console.log('\n4. 测试加载翻译模型:');
    
    // 尝试多个可能的模型路径
    const possiblePaths = [
        path.join(__dirname, 'native', 'model', 'm2m100-ct2'),  // 用户的 m2m100 模型
        path.join(__dirname, 'native', 'models', 'm2m100-ct2'),
        path.join(__dirname, 'native', 'models', 'opus-mt-ja-zh-ct2'),
        path.join(__dirname, 'native', 'models', 'nllb-200'),
    ];
    
    let modelPath = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            // 检查是否有必需的模型文件
            const hasModelBin = fs.existsSync(path.join(p, 'model.bin'));
            const hasConfig = fs.existsSync(path.join(p, 'config.json'));
            
            if (hasModelBin && hasConfig) {
                modelPath = p;
                console.log('  ✓ 找到翻译模型:', modelPath);
                break;
            } else {
                console.log(`  ⚠ 目录存在但缺少必需文件: ${p}`);
                if (!hasModelBin) console.log('    缺少: model.bin');
                if (!hasConfig) console.log('    缺少: config.json');
            }
        }
    }
    
    if (modelPath) {
        try {
            console.log('  正在加载模型...');
            const result = llwhisper.loadTranslateModel(modelPath, 'cuda');
            
            if (result) {
                console.log('  ✓ 模型加载成功！');
                
                // 测试翻译
                console.log('\n5. 测试翻译功能:');
                
                // M2M100 需要在输入前添加源语言标记
                const testCases = [
                    { text: '__ja__ こんにちは、世界！', targetLang: '__zh__', desc: '日语->中文' },
                    { text: '__en__ Hello, world!', targetLang: '__zh__', desc: '英语->中文' },
                    { text: '__zh__ 今天天气真好。', targetLang: '__ja__', desc: '中文->日语' }
                ];
                
                for (const test of testCases) {
                    try {
                        console.log(`\n  测试 ${test.desc}:`);
                        console.log('  输入:', test.text);
                        
                        const translated = llwhisper.translateText(test.text, { 
                            target_prefix: [test.targetLang],
                            beam_size: 4 
                        });
                        console.log('  输出:', translated);
                        
                    } catch (err) {
                        console.log('  ✗ 翻译失败:', err.message);
                    }
                }
                
                // 测试批量翻译
                console.log('\n6. 测试批量翻译:');
                try {
                    // M2M100 批量翻译也需要语言标记
                    const batchTexts = [
                        '__ja__ こんにちは',
                        '__ja__ ありがとう',
                        '__ja__ さようなら'
                    ];
                    console.log('  输入批量文本:', batchTexts);
                    
                    const batchResults = llwhisper.translateBatch(batchTexts, { 
                        target_prefix: ['__zh__'],
                        beam_size: 4 
                    });
                    console.log('  批量翻译结果:');
                    for (let i = 0; i < batchResults.length; i++) {
                        console.log(`    ${i + 1}. ${batchTexts[i]} -> ${batchResults[i]}`);
                    }
                    console.log('  ✓ 批量翻译功能正常！');
                    
                } catch (err) {
                    console.log('  ✗ 批量翻译失败:', err.message);
                }
                
            } else {
                console.log('  ✗ 模型加载失败');
            }
        } catch (err) {
            console.log('  ✗ 加载模型出错:', err.message);
            console.log('  错误详情:', err.stack);
        }
    } else {
        console.log('  ✗ 未找到翻译模型');
        console.log('\n  已检查的路径:');
        possiblePaths.forEach(p => console.log(`    - ${p}`));
        console.log('\n  请确保模型目录包含:');
        console.log('    - model.bin');
        console.log('    - config.json');
        console.log('    - shared_vocabulary.json (或 source/target_vocabulary.json)');
    }
    
    console.log('\n=== 测试完成 ===\n');
    
} catch (error) {
    console.log('  ✗ 加载失败:', error.message);
    console.log('\n错误详情:');
    console.log(error);
    process.exit(1);
}
