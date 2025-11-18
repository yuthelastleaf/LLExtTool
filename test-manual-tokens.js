const { loadTranslateModel, translateWithTokens } = require('./llwhisper.node');

const modelPath = String.raw`f:\GitProject\LLExtTool\native\model\opus-mt-tc-big-zh-ja-ct2`;

console.log('Loading model...');
const modelLoaded = loadTranslateModel(modelPath, 'cuda', 0);
console.log('Model loaded:', modelLoaded);

// 手动提供 tokens，模拟 Transformers tokenizer 的输出
// 根据 shared_vocabulary.json 的格式，我们需要单字符的 tokens
const testCases = [
    {
        text: '你好',
        // 模拟正确的 tokenization: "▁你" + "好" + "</s>"
        tokens: ['▁你', '好', '</s>']
    },
    {
        text: 'Hello',
        tokens: ['▁H', 'ello', '</s>']
    },
    {
        text: '今天天气很好',
        // 按单字分词
        tokens: ['▁今', '天', '天', '气', '很', '好', '</s>']
    }
];

console.log('\n=== Testing Translation with Manual Tokens ===\n');

for (const testCase of testCases) {
    console.log(`Input: "${testCase.text}"`);
    console.log(`Tokens: [${testCase.tokens.map(t => `"${t}"`).join(', ')}]`);
    
    try {
        const result = translateWithTokens(testCase.tokens);
        console.log(`Output: "${result}"`);
        console.log(`Output hex: ${Buffer.from(result).toString('hex').substring(0, 100)}...\n`);
    } catch (error) {
        console.error(`Error: ${error.message}\n`);
    }
}
