# Electron 翻译功能集成指南

## 功能概述

已成功将 M2M100 翻译模型集成到 Electron 应用中，支持视频字幕的自动翻译功能。

## 工作流程

```
视频输入 → 音频提取 → Whisper 转录 → M2M100 翻译 → 双语字幕输出
```

## 已实现的功能

### 1. 配置管理 (`src/shared/types.ts`)

```typescript
export interface AppConfig {
  whisperModelPath: string;              // Whisper 模型文件路径 (.bin)
  translationModelPath: string;          // CTranslate2 模型目录路径
  translationTokenizerPath: string;      // SentencePiece tokenizer 文件路径
  defaultSourceLanguage: 'ja' | 'en';
  defaultTargetLanguage: 'zh';
  // ...
}
```

### 2. 模型加载 (`src/main/ipc-handlers.ts`)

启动时自动加载：
- ✅ 验证模型文件完整性（model.bin, config.json）
- ✅ 验证 tokenizer 文件存在
- ✅ 使用 CUDA GPU 加速
- ✅ 加载 SentencePiece tokenizer

### 3. IPC 翻译接口

#### 单个翻译
```typescript
ipcRenderer.invoke(
  IpcChannels.TRANSLATE_TEXT,
  text: string,
  sourceLang: string,
  targetLang: string
) -> Promise<string>
```

#### 批量翻译
```typescript
ipcRenderer.invoke(
  IpcChannels.BATCH_TRANSLATE,
  texts: string[],
  sourceLang: string,
  targetLang: string
) -> Promise<string[]>
```

### 4. 渲染进程集成 (`src/renderer/renderer.ts`)

视频处理流程中的翻译步骤：

```typescript
// 1. 转录音频 (Whisper)
const segments = await ipcRenderer.invoke(
  IpcChannels.TRANSCRIBE_AUDIO,
  audioPath,
  sourceLanguage
);

// 2. 批量翻译
const texts = segments.map(seg => seg.text);
const translations = await ipcRenderer.invoke(
  IpcChannels.BATCH_TRANSLATE,
  texts,
  sourceLanguage,
  targetLanguage
);

// 3. 合并结果
const finalSegments = segments.map((seg, index) => ({
  ...seg,
  translatedText: translations[index]
}));
```

## 支持的语言

M2M100 模型支持 100 种语言，常用语言代码：

| 语言 | 代码 | M2M100 格式 |
|------|------|------------|
| 英语 | `en` | `__en__` |
| 日语 | `ja` | `__ja__` |
| 中文 | `zh` | `__zh__` |
| 韩语 | `ko` | `__ko__` |
| 法语 | `fr` | `__fr__` |
| 德语 | `de` | `__de__` |
| 西班牙语 | `es` | `__es__` |

## 配置步骤

### 1. 设置模型路径

在应用设置界面配置：

- **翻译模型路径**: 选择 `native/model/m2m100-ct2` 目录
- **Tokenizer 路径**: 选择 `native/model/m2m100_418M/sentencepiece.bpe.model` 文件

### 2. 验证模型文件

确保以下文件存在：

```
native/model/
├── m2m100-ct2/
│   ├── model.bin         (488 MB)
│   └── config.json
└── m2m100_418M/
    └── sentencepiece.bpe.model (2.4 MB)
```

### 3. 重启应用

配置保存后重启应用，模型将在启动时自动加载。

## 测试结果

### 英文 → 日文
```
原文: "Hello, how are you?"
译文: "こんにちは、あなたはどうですか?"
```

### 英文 → 中文
```
原文: "Hello, how are you?"
译文: "你好,你怎么样?"
```

### 批量翻译性能
- 4 个字幕片段：约 1-2 秒（GPU 加速）
- 支持最大批量大小：32 个片段

## UI 集成建议

### 1. 设置界面

在设置页面添加：
- [ ] 翻译模型路径选择器（目录选择）
- [ ] Tokenizer 路径选择器（文件选择）
- [ ] 默认源语言下拉框
- [ ] 默认目标语言下拉框
- [ ] 模型状态指示器（已加载/未加载）

### 2. 主界面翻译选项

视频处理界面添加：
- [x] 源语言选择（已有）
- [x] 目标语言选择（已有）
- [ ] 翻译开关（启用/禁用翻译）
- [ ] 翻译进度指示器

### 3. 字幕编辑器

三栏编辑器增强：
- [ ] 单条字幕翻译按钮
- [ ] 批量翻译所有字幕按钮
- [ ] 翻译质量调整（beam_size 参数）
- [ ] 重新翻译功能

## 性能优化

### 当前配置
```javascript
{
  target_prefix: ['__zh__'],  // 目标语言
  beam_size: 4,               // 搜索束大小
  max_batch_size: 32,         // 批量大小
  length_penalty: 1           // 长度惩罚
}
```

### 优化建议

1. **提高翻译速度**（牺牲质量）：
   ```javascript
   { beam_size: 1, max_batch_size: 64 }
   ```

2. **提高翻译质量**（牺牲速度）：
   ```javascript
   { beam_size: 8, length_penalty: 0.6 }
   ```

3. **平衡模式**（推荐）：
   ```javascript
   { beam_size: 4, max_batch_size: 32 }
   ```

## 错误处理

### 模型未加载
```typescript
if (!llwhisper?.translateText) {
  console.warn('Translation module not loaded, returning original text');
  return text; // 返回原文
}
```

### 翻译失败
```typescript
try {
  const result = await ipcRenderer.invoke(IpcChannels.BATCH_TRANSLATE, texts, src, tgt);
  return result;
} catch (error) {
  console.error('Translation failed:', error);
  return texts; // 返回原文
}
```

## 下一步开发

### 高优先级
- [ ] 添加设置界面的翻译模型配置
- [ ] 在字幕编辑器中添加单条翻译按钮
- [ ] 显示翻译进度（批量翻译时）

### 中优先级
- [ ] 支持翻译质量参数调整
- [ ] 添加翻译缓存（避免重复翻译）
- [ ] 支持自定义语言对

### 低优先级
- [ ] 集成更多翻译模型（OPUS-MT 需要 Transformers.js）
- [ ] 支持翻译结果对比
- [ ] 添加翻译历史记录

## 故障排除

### 问题：翻译返回原文
**原因**: 模型或 tokenizer 未正确加载

**解决方案**:
1. 检查配置文件中的路径是否正确
2. 验证模型文件是否完整
3. 查看启动日志中的错误信息

### 问题：翻译结果不正确
**原因**: 语言代码格式错误

**解决方案**:
确保使用正确的 M2M100 格式：`__ja__`, `__zh__` 等

### 问题：翻译速度慢
**原因**: CPU 模式或 batch_size 过小

**解决方案**:
1. 确认 CUDA 模式已启用
2. 增大 `max_batch_size` 参数
3. 减小 `beam_size` 参数

## 技术细节

### C++ 实现 (`native/src/translate_wrapper.cpp`)
- 使用 CTranslate2 库进行模型推理
- SentencePiece tokenizer 处理文本编码/解码
- 支持 CUDA GPU 加速
- 自动过滤 M2M100 语言标签

### Node.js 绑定 (`native/src/llwhisper.cpp`)
- N-API 接口暴露翻译函数
- 支持单个和批量翻译
- 可配置翻译参数

### TypeScript 集成 (`src/main/ipc-handlers.ts`)
- IPC 处理器封装翻译逻辑
- 自动语言代码转换
- 错误处理和降级策略

## 测试

运行完整测试：
```bash
node test-electron-translate.js
```

测试内容：
- ✅ 模型加载
- ✅ Tokenizer 加载
- ✅ 单个翻译
- ✅ 批量翻译
- ✅ IPC 流程模拟
- ✅ 字幕片段处理

---

**最后更新**: 2025-11-18
**状态**: ✅ 核心功能已完成，可用于生产环境
