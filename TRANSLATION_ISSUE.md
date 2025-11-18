# Translation Issue - Root Cause Analysis

## 问题

翻译输出全是 `⁇` (UNK tokens)，即使 UTF-8 编码正确。

## 根本原因

**Tokenizer 不匹配！**

### 错误的做法（当前实现）

```
Input: "你好"
  ↓
SentencePiece tokenizer (source.spm)
  ↓  
Tokens: ["▁你好"]  ← 单个 token 包含完整短语
  ↓
CTranslate2 translate_batch()
  ↓
查找 shared_vocabulary.json 中的 "▁你好"
  ↓
找不到！(vocabulary 只有单字符 tokens 如 "\u4f60", "\u5a7d")
  ↓
返回 <unk> tokens → ⁇⁇⁇
```

### 正确的做法

```
Input: "你好"
  ↓
Transformers AutoTokenizer (from Hugging Face)
  ↓
Token IDs: [15420, 3928, 3]  ← 使用 model vocabulary 的 IDs
  ↓
convert_ids_to_tokens()
  ↓
Token strings: ["▁你", "好", "</s>"]  ← 与 shared_vocabulary.json 对应
  ↓
CTranslate2 translate_batch([token_strings])
  ↓
成功翻译！
```

## 为什么会出现这个问题？

用户使用 `ct2-transformers-converter` 转换模型：
```bash
ct2-transformers-converter --model opus-mt-tc-big-zh-ja --output_dir opus-mt-tc-big-zh-ja-ct2
```

这个命令从 **Hugging Face Transformers** 转换模型，所以：
- shared_vocabulary.json 是 Transformers 模型的 vocabulary
- 需要使用 Transformers tokenizer 进行 tokenization
- SentencePiece tokenizer (source.spm) 是 **原始训练模型** 的 tokenizer，与转换后的 CTranslate2 模型不兼容！

## 证据

### CTranslate2 文档（transformers.md）

MarianMT 示例：
```python
import ctranslate2
import transformers

translator = ctranslate2.Translator("opus-mt-en-de")
tokenizer = transformers.AutoTokenizer.from_pretrained("Helsinki-NLP/opus-mt-en-de")

source = tokenizer.convert_ids_to_tokens(tokenizer.encode("Hello world!"))
results = translator.translate_batch([source])
```

**注意**：使用 `transformers.AutoTokenizer`，而不是 SentencePiece！

### Vocabulary 对比

**shared_vocabulary.json**（前 10 个 tokens）：
```json
[
  "<unk>",      // 0
  "<s>",        // 1
  "</s>",       // 2
  "▁",          // 3
  "。",         // 4
  "、",         // 5
  "\u4e00",     // 6: 一
  "\u4e8c",     // 7: 二
  ...
]
```

**SentencePiece tokenizer 输出**：
```
"你好" → ["▁你好"]  ← 组合 token，不在 vocabulary 中！
```

**Transformers tokenizer 输出**：
```
"你好" → IDs: [15420, 3928, 3]
       → Tokens: ["▁你", "好", "</s>"]  ← 单字符，与 vocabulary 对应！
```

## 解决方案

### 方案 1：在 JavaScript 层使用 Transformers tokenizer（推荐）

1. 安装 `@xenova/transformers` (Transformers.js)
2. 在 JavaScript 中 tokenize
3. 传递 token strings 给 C++ 的 translate 函数

```javascript
import { AutoTokenizer } from '@xenova/transformers';

const tokenizer = await AutoTokenizer.from_pretrained('Helsinki-NLP/opus-mt-zh-ja');
const { input_ids } = await tokenizer('你好');
const tokens = input_ids.map(id => tokenizer.decode([id], { skip_special_tokens: false }));

// 传递 tokens 给 C++
const result = translateWithTokens(tokens);
```

### 方案 2：重新转换模型使用 SentencePiece（不推荐）

使用 `ct2-opus-mt-converter` 而不是 `ct2-transformers-converter`：
```bash
ct2-opus-mt-converter --model_dir opus-mt-tc-big-zh-ja --output_dir opus-mt-tc-big-zh-ja-ct2
```

但这需要原始的 Marian model 格式，而不是 Hugging Face 格式。

### 方案 3：在 C++ 中集成 Transformers tokenizer（复杂）

需要：
- 实现 BPE / WordPiece tokenizer
- 加载 vocab.json / tokenizer.json
- 处理特殊 tokens
- 工作量大，不推荐

## 当前状态

- ✅ UTF-8 encoding 正确
- ✅ SentencePiece tokenizer 工作正常
- ❌ 使用了错误的 tokenizer（SentencePiece vs Transformers）
- ❌ Token 格式不匹配 CTranslate2 vocabulary

## 下一步

实现方案 1：在 JavaScript 端使用 Transformers.js tokenizer。
