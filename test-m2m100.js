const { loadTranslateModel, loadTranslateTokenizer, translateText } = require('./llwhisper.node');

// 使用 M2M100 模型
const modelPath = String.raw`f:\GitProject\LLExtTool\native\model\m2m100-ct2`;
const tokenizerPath = String.raw`f:\GitProject\LLExtTool\native\model\m2m100_418M\sentencepiece.bpe.model`;

console.log('Loading M2M100 model...');
const modelLoaded = loadTranslateModel(modelPath, 'cuda', 0);
console.log('Model loaded:', modelLoaded);

console.log('\nLoading SentencePiece tokenizer...');
const tokenizerLoaded = loadTranslateTokenizer(tokenizerPath);
console.log('Tokenizer loaded:', tokenizerLoaded);

const testCases = [
    {
        text: 'Hello world',
        options: {
            beam_size: 4,
            target_prefix: ['__ja__']  // 翻译到日语
        }
    },
    {
        text: 'Good morning',
        options: {
            beam_size: 4,
            target_prefix: ['__ja__']
        }
    },
    {
        text: 'How are you?',
        options: {
            beam_size: 4,
            target_prefix: ['__ja__']
        }
    },
    {
        text: 'Thank you',
        options: {
            beam_size: 4,
            target_prefix: ['__zh__']  // 翻译到中文
        }
    }
];

console.log('\n=== Testing M2M100 Translation ===\n');

for (const testCase of testCases) {
    const targetLang = testCase.options.target_prefix[0];
    console.log(`Input: "${testCase.text}" -> ${targetLang}`);
    
    try {
        const result = translateText(testCase.text, testCase.options);
        console.log(`Output: "${result}"`);
        console.log(`Output hex: ${Buffer.from(result).toString('hex').substring(0, 100)}...\n`);
    } catch (error) {
        console.error(`Error: ${error.message}\n`);
    }
}

console.log('=== Test Complete ===');
