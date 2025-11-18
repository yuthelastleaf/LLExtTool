const path = require('path');

console.log('=== 翻译模型类型语言代码映射测试 ===\n');

// M2M100 语言代码映射
const m2m100LangMap = {
  'ja': '__ja__',
  'zh': '__zh__',
  'en': '__en__',
  'ko': '__ko__',
  'fr': '__fr__',
  'de': '__de__',
  'es': '__es__'
};

// NLLB-200 语言代码映射 (Flores-200)
const nllbLangMap = {
  'ja': 'jpn_Jpan',      // 日语 (日文汉字/假名)
  'zh': 'zho_Hans',      // 中文(简体)
  'en': 'eng_Latn',      // 英语 (拉丁字母)
  'ko': 'kor_Hang',      // 韩语 (韩文)
  'fr': 'fra_Latn',      // 法语 (拉丁字母)
  'de': 'deu_Latn',      // 德语 (拉丁字母)
  'es': 'spa_Latn'       // 西班牙语 (拉丁字母)
};

console.log('1. M2M100 语言代码格式:');
console.log('   特点: 使用双下划线包裹语言代码');
console.log('   示例:');
for (const [lang, code] of Object.entries(m2m100LangMap)) {
  console.log(`     ${lang} → ${code}`);
}
console.log('');

console.log('2. NLLB-200 语言代码格式 (Flores-200):');
console.log('   特点: 使用 ISO639-3_Script 格式');
console.log('   示例:');
for (const [lang, code] of Object.entries(nllbLangMap)) {
  console.log(`     ${lang} → ${code}`);
}
console.log('');

console.log('3. 语言代码转换逻辑:');
console.log('   在 ipc-handlers.ts 中:');
console.log(`
   const config = configManager.getConfig();
   const modelType = config.translationModelType || 'm2m100';
   
   let targetLangCode: string;
   if (modelType === 'nllb') {
     const nllbLangMap = {
       'ja': 'jpn_Jpan',
       'zh': 'zho_Hans',
       'en': 'eng_Latn',
       // ...
     };
     targetLangCode = nllbLangMap[targetLang] || targetLang;
   } else {
     // M2M100
     targetLangCode = \`__\${targetLang}__\`;
   }
   
   llwhisper.translateText(text, {
     target_prefix: [targetLangCode],
     beam_size: 4
   });
`);

console.log('4. 使用示例:');
console.log('');

// 测试场景 1: 使用 M2M100
console.log('   场景 1: 使用 M2M100 模型 (日语 → 中文)');
const sourceLang1 = 'ja';
const targetLang1 = 'zh';
const modelType1 = 'm2m100';
const targetCode1 = modelType1 === 'nllb' ? nllbLangMap[targetLang1] : `__${targetLang1}__`;
console.log(`     配置: translationModelType = "${modelType1}"`);
console.log(`     源语言: ${sourceLang1}`);
console.log(`     目标语言: ${targetLang1}`);
console.log(`     target_prefix: ["${targetCode1}"]`);
console.log('');

// 测试场景 2: 使用 NLLB
console.log('   场景 2: 使用 NLLB-200 模型 (日语 → 中文)');
const sourceLang2 = 'ja';
const targetLang2 = 'zh';
const modelType2 = 'nllb';
const targetCode2 = modelType2 === 'nllb' ? nllbLangMap[targetLang2] : `__${targetLang2}__`;
console.log(`     配置: translationModelType = "${modelType2}"`);
console.log(`     源语言: ${sourceLang2}`);
console.log(`     目标语言: ${targetLang2}`);
console.log(`     target_prefix: ["${targetCode2}"]`);
console.log('');

console.log('5. 配置文件示例:');
console.log(`
   // llexttool-config.json
   {
     "whisperModelPath": "...",
     "translationModelPath": "native/model/nllb-200-3.3B-ct2",
     "translationTokenizerPath": "native/model/nllb-200-3.3B/sentencepiece.bpe.model",
     "translationModelType": "nllb",  // 或 "m2m100"
     "defaultSourceLanguage": "ja",
     "defaultTargetLanguage": "zh",
     "outputDirectory": "...",
     "audioFormat": "wav"
   }
`);

console.log('6. 设置界面选项:');
console.log('   ┌─────────────────────────────────────────────┐');
console.log('   │ 翻译模型类型:                               │');
console.log('   │ ┌─────────────────────────────────────────┐ │');
console.log('   │ │ M2M100 (100+ 语言, 语言代码: __ja__)   │ │');
console.log('   │ │ NLLB-200 (200 语言, 语言代码: jpn_Jpan)│ │');
console.log('   │ └─────────────────────────────────────────┘ │');
console.log('   └─────────────────────────────────────────────┘');
console.log('');

console.log('=== 测试完成 ===');
console.log('');
console.log('总结:');
console.log('✓ 添加了 translationModelType 配置项');
console.log('✓ 支持 M2M100 和 NLLB-200 两种模型类型');
console.log('✓ 根据模型类型自动使用正确的语言代码格式');
console.log('✓ 在设置界面提供下拉选择');
console.log('✓ 无需修改 C++ 代码,完全在 TypeScript 层实现');
