# 翻译功能实现状态

## 已完成

✅ **CTranslate2 库编译**
- 成功从源码编译 CTranslate2 v4.5.0
- 支持 CUDA 加速
- 库文件：`native/ctranslate2/bin/ctranslate2.dll` (~200MB)

✅ **C++ 翻译封装器**
- 实现了 `TranslateWrapper` 类
- 提供 `loadModel()`, `translate()`, `translateBatch()` 方法
- 支持参数：beam_size, length_penalty, max_batch_size, target_prefix

✅ **Node.js 绑定**
- 通过 `llwhisper.node` 导出翻译函数
- JavaScript API:
  - `llwhisper.loadTranslateModel(path, device)`
  - `llwhisper.translateText(text, options)`
  - `llwhisper.translateBatch(texts, options)`

✅ **IPC 集成**
- 主进程自动加载翻译模型
- 处理 `TRANSLATE_TEXT` 和 `BATCH_TRANSLATE` 消息
- 渲染进程可以调用翻译功能

✅ **模型支持**
- M2M100 模型已转换为 CTranslate2 格式
- 模型位置：`native/model/m2m100-ct2/`
- 文件：model.bin (488MB), config.json, shared_vocabulary.json

## 当前问题

❌ **Tokenization 缺失**

M2M100 和其他 Transformer 模型需要 SentencePiece tokenizer 来将文本转换为 subword tokens。当前实现的简单 tokenization（按语言标记分割）不足以支持真实翻译。

**已验证的症状：**
- ✅ 模型加载成功（CPU 和 CUDA 都可以）
- ✅ 使用 CUDA 时翻译不再卡住（CPU 版本会卡住）
- ❌ 输出全是 `<unk>`（未知token）或重复内容
- ✅ 语言标记（`__ja__`, `__zh__` 等）被正确识别
- ❌ 原始文本（如 "hello"）无法被识别

**根本原因：**
```cpp
// 当前的简单 tokenization
Input:  "__ja__ こんにちは、世界！"
Tokens: ["__ja__", "こんにちは、世界！"]  // ❌ 错误

// 需要的 SentencePiece tokenization
Input:  "__ja__ こんにちは、世界！"
Tokens: ["__ja__", "▁こんにちは", "▁", "、", "▁世界", "▁！"]  // ✅ 正确
```

## 解决方案

### 方案 1：JavaScript 端 Token化（推荐）

使用 `@xenova/transformers` 在 Node.js 端进行 tokenization：

```bash
npm install @xenova/transformers
```

```javascript
import { AutoTokenizer } from '@xenova/transformers';

const tokenizer = await AutoTokenizer.from_pretrained('facebook/m2m100_418M');
const tokens = tokenizer.encode('__ja__ こんにちは');
// 传递 tokens 到 C++ 层
```

**优点：**
- 不需要修改 C++ 代码
- 易于维护和更新
- 支持多种模型

**缺点：**
- 需要额外的 npm 包
- 首次加载 tokenizer 可能较慢

### 方案 2：C++ 端集成 SentencePiece

在 `translate_wrapper.cpp` 中集成 SentencePiece 库：

```cpp
#include <sentencepiece_processor.h>

sentencepiece::SentencePieceProcessor processor;
processor.Load("native/model/m2m100-ct2/tokenizer.model");
std::vector<std::string> tokens;
processor.Encode(text, &tokens);
```

**优点：**
- 更快的 tokenization
- 不依赖 JavaScript 包

**缺点：**
- 需要编译 SentencePiece 库
- 增加编译复杂度
- M2M100 使用共享词汇表，需要额外处理

### 方案 3：使用预 token化的模型

切换到支持字符级或简单 tokenization 的翻译模型：

- **OPUS-MT**: 字符级 tokenization，更简单
- **小型 NLLB**: 可能也需要 SentencePiece

## 测试文件

`test-translate.js` 已准备好，包含：
- M2M100 模型路径检测
- 单句翻译测试（日语→中文，英语→中文，中文→日语）
- 批量翻译测试

要运行（一旦 tokenization 解决）：
```bash
node test-translate.js
```

## 测试结果

使用 RTX 5070 GPU (CUDA 12.9) 测试：

| 输入 | 期望输出 | 实际输出 | 状态 |
|------|---------|---------|------|
| `__ja__` (纯语言标记) | (空或错误) | "那是谁？"（重复） | ⚠️ 模型工作但输入无意义 |
| `__en__ hello` | "你好" | `<unk> <unk> <unk>...` | ❌ 未正确 tokenize |
| `__en__ 123` | "123" | `▁ ▁ ▁ ▁...` | ❌ 未正确 tokenize |
| `__ja__ こんにちは` | "你好" | `<unk> <unk> <unk>...` | ❌ 未正确 tokenize |

**关键发现：**
- GPU 加速工作正常（不再卡住）
- 模型可以识别语言标记
- 需要 SentencePiece tokenizer 来处理实际文本

## 推荐方案

### 方案 A：切换到 OPUS-MT 模型（最简单）✅ 推荐

OPUS-MT 模型使用字符级或简单的 BPE tokenization，更容易集成：

```bash
# 下载 OPUS-MT 日中翻译模型
ct2-opus-mt-ja-zh-converter --model_name Helsinki-NLP/opus-mt-ja-zh --output_dir native/model/opus-mt-ja-zh-ct2
```

**优点：**
- 不需要复杂的 tokenization
- 模型较小，加载更快
- 支持多个语言对

**缺点：**
- 翻译质量可能略低于 M2M100
- 每个语言对需要单独的模型

### 方案 B：使用预 tokenized 输入

修改 API，让 JavaScript 端传递已经 tokenize 的文本：

```javascript
// 使用 Python 或其他工具预先 tokenize
const tokens = ['▁', 'Hello', ',', '▁world', '!'];
llwhisper.translateTokens(tokens, options);  // 新 API
```

### 方案 C：暂时禁用翻译功能

在实现正确的 tokenization 之前，在 UI 中隐藏或禁用翻译按钮。

## 下一步

1. **立即：** 决定使用哪个方案
2. **短期：** 如果选择 OPUS-MT，下载并测试新模型
3. **中期：** 实现 JavaScript 端 tokenization（如果需要 M2M100）
4. **长期：** 优化翻译性能和质量

## 相关文件

- C++ 实现：
  - `native/src/translate_wrapper.cpp`
  - `native/include/translate_wrapper.h`
  - `native/src/llwhisper.cpp` (Node.js bindings)
  
- JavaScript 集成：
  - `src/main/ipc-handlers.ts` (IPC handlers)
  - `test-translate.js` (测试脚本)

- 模型：
  - `native/model/m2m100-ct2/` (M2M100 模型)
  
- 构建：
  - `binding.gyp` (Node.js addon configuration)
  - `build-ctranslate2.ps1` (CTranslate2 编译脚本)
