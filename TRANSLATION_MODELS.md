# 翻译模型配置指南

本文档说明如何在 LLExtTool 中配置和使用不同的翻译模型。

## 支持的模型类型

### 1. M2M100 (Meta AI)

**特点:**
- 支持 100+ 种语言
- 模型大小: 418M / 1.2B 参数
- 语言代码格式: `__ja__`, `__zh__`, `__en__`
- 适合: 多语言场景,资源有限

**下载和转换:**

```bash
# 1. 安装依赖
pip install ctranslate2 transformers sentencepiece

# 2. 转换模型
ct2-transformers-converter \
  --model facebook/m2m100_418M \
  --output_dir native/model/m2m100-ct2 \
  --quantization float16

# 3. Tokenizer 会自动下载到
# ~/.cache/huggingface/hub/models--facebook--m2m100_418M/snapshots/.../sentencepiece.bpe.model
```

**配置示例:**

```json
{
  "translationModelPath": "F:/GitProject/LLExtTool/native/model/m2m100-ct2",
  "translationTokenizerPath": "F:/GitProject/LLExtTool/native/model/m2m100_418M/sentencepiece.bpe.model",
  "translationModelType": "m2m100"
}
```

**支持的语言对 (部分):**
- 日语 (ja) ↔ 中文 (zh)
- 英语 (en) ↔ 中文 (zh)
- 韩语 (ko) ↔ 中文 (zh)
- 法语 (fr) ↔ 中文 (zh)
- 德语 (de) ↔ 中文 (zh)
- 西班牙语 (es) ↔ 中文 (zh)

---

### 2. NLLB-200 (No Language Left Behind)

**特点:**
- 支持 200 种语言 (Flores-200 语言集)
- 模型大小: 600M / 1.3B / **3.3B** / 54B 参数
- 语言代码格式: `jpn_Jpan`, `zho_Hans`, `eng_Latn`
- 适合: 高质量翻译,低资源语言

**下载和转换:**

```bash
# 推荐使用 3.3B 模型 (质量与速度平衡)
ct2-transformers-converter \
  --model facebook/nllb-200-3.3B \
  --output_dir native/model/nllb-200-3.3B-ct2 \
  --quantization float16 \
  --low_cpu_mem_usage

# 或使用小模型 (更快)
ct2-transformers-converter \
  --model facebook/nllb-200-distilled-600M \
  --output_dir native/model/nllb-200-600M-ct2 \
  --quantization float16
```

**配置示例:**

```json
{
  "translationModelPath": "F:/GitProject/LLExtTool/native/model/nllb-200-3.3B-ct2",
  "translationTokenizerPath": "F:/GitProject/LLExtTool/native/model/nllb-200-3.3B/sentencepiece.model",
  "translationModelType": "nllb"
}
```

**Flores-200 语言代码:**

| 语言 | 短代码 | NLLB 代码 | 说明 |
|------|--------|-----------|------|
| 日语 | ja | `jpn_Jpan` | 日文汉字/假名 |
| 中文(简) | zh | `zho_Hans` | 简体中文 |
| 中文(繁) | - | `zho_Hant` | 繁体中文 |
| 英语 | en | `eng_Latn` | 拉丁字母 |
| 韩语 | ko | `kor_Hang` | 韩文 |
| 法语 | fr | `fra_Latn` | 拉丁字母 |
| 德语 | de | `deu_Latn` | 拉丁字母 |
| 西班牙语 | es | `spa_Latn` | 拉丁字母 |

完整列表: https://github.com/facebookresearch/flores/blob/main/flores200/README.md#languages-in-flores-200

---

## 如何在应用中切换模型

### 步骤 1: 准备模型文件

确保你已经转换好模型并放在正确的目录:

```
native/model/
├── m2m100-ct2/
│   ├── model.bin
│   ├── config.json
│   └── shared_vocabulary.json
├── m2m100_418M/
│   └── sentencepiece.bpe.model
├── nllb-200-3.3B-ct2/
│   ├── model.bin
│   ├── config.json
│   └── shared_vocabulary.json
└── nllb-200-3.3B/
    └── sentencepiece.model
```

### 步骤 2: 在设置界面配置

1. 启动应用,点击右上角 **⚙️ 设置**
2. 配置以下字段:

   **翻译模型路径 (目录):**
   ```
   F:\GitProject\LLExtTool\native\model\nllb-200-3.3B-ct2
   ```

   **翻译 Tokenizer 路径:**
   ```
   F:\GitProject\LLExtTool\native\model\nllb-200-3.3B\sentencepiece.model
   ```

   **翻译模型类型:**
   ```
   ┌───────────────────────────────────────────┐
   │ M2M100 (100+ 语言, 语言代码: __ja__)     │
   │ NLLB-200 (200 语言, 语言代码: jpn_Jpan) ✓│ ← 选择这个
   └───────────────────────────────────────────┘
   ```

3. 点击 **保存**
4. 点击 **🔄 重新加载翻译模型** (无需重启应用)

### 步骤 3: 开始翻译

现在你可以正常使用翻译功能,系统会自动:
- 使用 NLLB 模型进行推理
- 将语言代码 `ja` 转换为 `jpn_Jpan`
- 将语言代码 `zh` 转换为 `zho_Hans`

---

## 模型性能对比

| 模型 | 参数量 | 模型大小 | 推理速度 (GPU) | 翻译质量 | 内存占用 |
|------|--------|----------|----------------|----------|----------|
| M2M100-418M | 418M | ~840 MB | 快 (40 tokens/s) | 良好 | ~2 GB |
| NLLB-600M | 600M | ~1.2 GB | 快 (35 tokens/s) | 良好 | ~2.5 GB |
| **NLLB-3.3B** | 3.3B | ~6.6 GB (FP16) | 中等 (20 tokens/s) | **优秀** | ~8 GB |
| NLLB-54B | 54B | ~108 GB | 慢 (5 tokens/s) | 最佳 | ~110 GB |

**推荐配置:**
- **开发/测试**: M2M100-418M
- **生产环境**: NLLB-3.3B (质量与速度最佳平衡)
- **低资源语言**: NLLB-3.3B 或更大模型

---

## 技术细节

### 语言代码自动转换

代码会根据 `translationModelType` 自动转换语言代码:

```typescript
// ipc-handlers.ts (简化版)
const config = configManager.getConfig();
const modelType = config.translationModelType || 'm2m100';

let targetLangCode: string;
if (modelType === 'nllb') {
  // NLLB: Flores-200 格式
  const nllbLangMap = {
    'ja': 'jpn_Jpan',
    'zh': 'zho_Hans',
    'en': 'eng_Latn',
    // ...
  };
  targetLangCode = nllbLangMap[targetLang];
} else {
  // M2M100: 双下划线格式
  targetLangCode = `__${targetLang}__`;
}

llwhisper.translateText(text, {
  target_prefix: [targetLangCode]
});
```

### C++ 层无需修改

两种模型都使用:
- **CTranslate2** 推理引擎
- **SentencePiece** tokenizer
- 相同的 API 接口

只有语言代码格式不同,在 TypeScript 层自动处理。

---

## 常见问题

### Q1: 如何知道我的模型是哪种类型?

**A:** 检查模型来源:
- 来自 `facebook/m2m100_*` → M2M100
- 来自 `facebook/nllb-200-*` → NLLB-200

### Q2: 能否同时使用两种模型?

**A:** 不行,一次只能加载一个模型。但可以随时在设置中切换并重新加载。

### Q3: 切换模型后需要重启应用吗?

**A:** 不需要!点击 "🔄 重新加载翻译模型" 按钮即可。

### Q4: NLLB 比 M2M100 好在哪里?

**A:**
- 支持更多语言 (200 vs 100+)
- 低资源语言翻译质量更好
- 更大的模型 (3.3B) 提供更准确的翻译
- 针对对话和字幕场景优化

### Q5: GPU 内存不够怎么办?

**A:** 使用量化版本:
```bash
# INT8 量化 (减少 75% 内存)
ct2-transformers-converter \
  --model facebook/nllb-200-3.3B \
  --quantization int8_float16 \
  --output_dir native/model/nllb-3.3B-int8
```

---

## 参考链接

- [M2M100 论文](https://arxiv.org/abs/2010.11125)
- [NLLB 论文](https://arxiv.org/abs/2207.04672)
- [CTranslate2 文档](https://opennmt.net/CTranslate2/)
- [Flores-200 语言列表](https://github.com/facebookresearch/flores/blob/main/flores200/README.md)
- [Hugging Face Models](https://huggingface.co/models?pipeline_tag=translation)

---

## 更新日志

- **2024-11-18**: 添加翻译模型类型选择功能,支持 M2M100 和 NLLB-200
