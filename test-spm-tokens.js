const { loadTranslateModel, loadTranslateTokenizer, translateText } = require('./llwhisper.node');

const modelPath = 'f:\\GitProject\\LLExtTool\\native\\model\\opus-mt-tc-big-zh-ja-ct2';
const tokenizerPath = 'f:\\GitProject\\LLExtTool\\native\\model\\opus-mt-tc-big-zh-ja\\source.spm';

console.log('Loading model...');
const modelLoaded = loadTranslateModel(modelPath, 'cuda', 0);
console.log('Model loaded:', modelLoaded);

console.log('\nLoading tokenizer...');
const tokenizerLoaded = loadTranslateTokenizer(tokenizerPath);
console.log('Tokenizer loaded:', tokenizerLoaded);

// Test simple translation
const testTexts = [
    '你好',
    'Hello',
    '今天天气很好',
];

console.log('\n=== Testing Translation ===');
testTexts.forEach(text => {
    console.log(`\nInput: "${text}"`);
    const result = translateText(text);
    console.log(`Output: "${result}"`);
    console.log(`Output bytes: ${Buffer.from(result).toString('hex')}`);
});
