# 翻译功能集成指南

本文档说明如何为 LLExtTool 添加翻译功能。

## 推荐方案：使用 Transformers.js

Transformers.js 是最简单且效果好的方案，无需编译 C++ 代码。

### 1. 安装依赖

```powershell
npm install @xenova/transformers
```

### 2. 修改 translator.ts

在 `src/services/translator.ts` 中实现翻译功能：

```typescript
import { pipeline } from '@xenova/transformers';

export class TranslatorService {
  private translator: any = null;
  private currentModel: string = '';

  async loadModel(modelPath: string): Promise<void> {
    // Transformers.js 使用模型名称而不是路径
    // 根据语言对选择模型
    this.currentModel = 'Xenova/opus-mt-ja-zh'; // 日语到中文
    
    // 预加载模型
    this.translator = await pipeline('translation', this.currentModel);
    this.modelLoaded = true;
  }

  async translate(
    text: string,
    sourceLang: 'ja' | 'en',
    targetLang: 'zh'
  ): Promise<string> {
    if (!text.trim()) return '';
    
    // 根据语言对选择模型
    const modelName = sourceLang === 'ja' 
      ? 'Xenova/opus-mt-ja-zh'
      : 'Xenova/opus-mt-en-zh';
    
    // 如果模型改变，重新加载
    if (this.currentModel !== modelName) {
      this.translator = await pipeline('translation', modelName);
      this.currentModel = modelName;
    }
    
    const result = await this.translator(text, {
      max_length: 512,
    });
    
    return result[0].translation_text;
  }

  async batchTranslate(
    texts: string[],
    sourceLang: 'ja' | 'en',
    targetLang: 'zh'
  ): Promise<string[]> {
    const results: string[] = [];
    
    for (const text of texts) {
      const translated = await this.translate(text, sourceLang, targetLang);
      results.push(translated);
    }
    
    return results;
  }
}
```

### 3. 在 IPC 处理器中使用

修改 `src/main/ipc-handlers.ts`：

```typescript
import { TranslatorService } from '../services/translator';

const translator = new TranslatorService();

// 在应用启动时预加载模型（可选）
app.whenReady().then(async () => {
  try {
    await translator.loadModel('');
    console.log('Translation model loaded');
  } catch (error) {
    console.error('Failed to load translation model:', error);
  }
});

// 翻译文本
ipcMain.handle(IpcChannels.TRANSLATE_TEXT, async (_, text, sourceLang, targetLang) => {
  try {
    return await translator.translate(text, sourceLang, targetLang);
  } catch (error: any) {
    throw new Error(`翻译失败: ${error.message}`);
  }
});

// 批量翻译
ipcMain.handle(IpcChannels.BATCH_TRANSLATE, async (_, texts, sourceLang, targetLang) => {
  try {
    return await translator.batchTranslate(texts, sourceLang, targetLang);
  } catch (error: any) {
    throw new Error(`批量翻译失败: ${error.message}`);
  }
});
```

## 可用的翻译模型

### OPUS-MT 系列（推荐，快速且轻量）

- **日语→中文**: `Xenova/opus-mt-ja-zh`
- **英语→中文**: `Xenova/opus-mt-en-zh`

### NLLB 系列（高质量，但较大）

- **多语言**: `Xenova/nllb-200-distilled-600M`
  - 支持 200+ 语言
  - 更高的翻译质量
  - 模型较大（~600MB）

使用示例：
```typescript
const translator = await pipeline('translation', 'Xenova/nllb-200-distilled-600M');
const result = await translator(text, {
  src_lang: 'jpn_Jpan',  // 日语
  tgt_lang: 'zho_Hans',  // 简体中文
});
```

### mBART 系列（多语言，质量好）

- **多语言**: `Xenova/mbart-large-50-many-to-many-mmt`
  - 支持 50 种语言
  - 高质量翻译
  - 模型较大（~1.5GB）

## 性能优化建议

### 1. 批量处理

批量处理可以提高效率：

```typescript
async batchTranslate(texts: string[]): Promise<string[]> {
  // 使用 Promise.all 并行处理
  const promises = texts.map(text => this.translate(text));
  return await Promise.all(promises);
}
```

### 2. 缓存翻译结果

避免重复翻译相同的文本：

```typescript
private cache = new Map<string, string>();

async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const key = `${sourceLang}-${targetLang}-${text}`;
  
  if (this.cache.has(key)) {
    return this.cache.get(key)!;
  }
  
  const result = await this.translator(text);
  this.cache.set(key, result[0].translation_text);
  
  return result[0].translation_text;
}
```

### 3. 进度反馈

对于大量文本，提供进度反馈：

```typescript
async batchTranslate(
  texts: string[],
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const results: string[] = [];
  
  for (let i = 0; i < texts.length; i++) {
    const translated = await this.translate(texts[i]);
    results.push(translated);
    
    if (onProgress) {
      onProgress(i + 1, texts.length);
    }
  }
  
  return results;
}
```

## 替代方案

### 方案 2: 使用在线翻译 API

如果不想在本地运行模型，可以使用在线 API：

#### 百度翻译 API

```typescript
import crypto from 'crypto';

async translateWithBaidu(text: string, from: string, to: string): Promise<string> {
  const appid = 'your_appid';
  const key = 'your_key';
  const salt = Date.now();
  const sign = crypto.createHash('md5')
    .update(appid + text + salt + key)
    .digest('hex');
  
  const response = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      q: text,
      from: from,
      to: to,
      appid: appid,
      salt: salt.toString(),
      sign: sign
    })
  });
  
  const result = await response.json();
  return result.trans_result[0].dst;
}
```

#### DeepL API（质量最好，但需付费）

```typescript
async translateWithDeepL(text: string, targetLang: string): Promise<string> {
  const apiKey = 'your_api_key';
  
  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: [text],
      target_lang: targetLang
    })
  });
  
  const result = await response.json();
  return result.translations[0].text;
}
```

### 方案 3: 离线 C++ 模型（高性能）

如果需要最高性能，可以使用 C++ 实现：

1. 使用 ONNX Runtime 运行 ONNX 格式的翻译模型
2. 类似 Whisper 的方式创建 native 模块
3. 需要编写更多 C++ 代码

## 模型下载和缓存

Transformers.js 会自动下载和缓存模型：

- 默认缓存位置：`~/.cache/huggingface/` (Linux/Mac) 或 `%USERPROFILE%\.cache\huggingface\` (Windows)
- 首次使用时会下载模型（可能需要几分钟）
- 后续使用会从缓存加载

可以预下载模型：

```typescript
import { pipeline, env } from '@xenova/transformers';

// 设置缓存目录
env.cacheDir = './models/transformers-cache';

// 预下载模型
await pipeline('translation', 'Xenova/opus-mt-ja-zh');
```

## 测试翻译功能

创建测试脚本 `test-translation.js`：

```javascript
const { TranslatorService } = require('./dist/services/translator');

async function test() {
  const translator = new TranslatorService();
  
  console.log('Loading model...');
  await translator.loadModel('');
  
  console.log('Translating...');
  const result = await translator.translate(
    'こんにちは、世界！',
    'ja',
    'zh'
  );
  
  console.log('Result:', result);
}

test();
```

运行：
```powershell
npm run build
node test-translation.js
```

## 常见问题

### Q: 第一次运行很慢
A: Transformers.js 需要下载模型，首次使用会比较慢。

### Q: 翻译质量不好
A: 尝试使用更大的模型（如 NLLB-600M）或在线 API（如 DeepL）。

### Q: 内存占用高
A: 使用较小的模型（如 OPUS-MT），或分批处理文本。

### Q: 想要离线使用
A: Transformers.js 会缓存模型，下载后可以离线使用。
