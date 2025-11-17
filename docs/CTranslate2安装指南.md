# CTranslate2 安装和模型准备

## 1. 下载 CTranslate2 Windows 预编译库

访问 CTranslate2 官方 Releases 页面：
https://github.com/OpenNMT/CTranslate2/releases

下载最新的 Windows x64 版本（例如 v4.5.0）：
```
ctranslate2-4.5.0-windows-x64.zip
```

## 2. 解压到项目目录

将下载的压缩包解压到项目的 `native/ctranslate2/` 目录：

```
F:\GitProject\LLExtTool\native\ctranslate2\
├── include\
│   └── ctranslate2\
│       ├── translator.h
│       ├── models\
│       └── ...
├── lib\
│   └── ctranslate2.lib
└── bin\
    ├── ctranslate2.dll
    └── (其他依赖的 DLL)
```

PowerShell 命令：
```powershell
# 创建目录
New-Item -Path "native\ctranslate2" -ItemType Directory -Force

# 下载最新版本 (v4.5.0)
Invoke-WebRequest -Uri "https://github.com/OpenNMT/CTranslate2/releases/download/v4.5.0/ctranslate2-4.5.0-windows-x64.zip" -OutFile "native\ctranslate2.zip"

# 解压
Expand-Archive -Path "native\ctranslate2.zip" -DestinationPath "native\ctranslate2" -Force

# 清理
Remove-Item "native\ctranslate2.zip"
```

## 3. 准备翻译模型

### 方法 1: 下载已转换的模型（推荐）

可以从 Hugging Face 下载已经转换好的 CTranslate2 格式模型：

```powershell
# 安装 git-lfs (如果还没安装)
# 访问 https://git-lfs.github.com/ 下载安装

# 克隆日译中模型（opus-mt-ja-zh）
git lfs install
git clone https://huggingface.co/Helsinki-NLP/opus-mt-ja-zh native/models/opus-mt-ja-zh

# 或者下载英译中模型
git clone https://huggingface.co/Helsinki-NLP/opus-mt-en-zh native/models/opus-mt-en-zh
```

### 方法 2: 手动转换模型

如果需要自己转换模型到 CTranslate2 格式：

```powershell
# 安装 Python 依赖
pip install ctranslate2 transformers sentencepiece protobuf

# 转换日译中模型
ct2-transformers-converter --model Helsinki-NLP/opus-mt-ja-zh --output_dir native/models/opus-mt-ja-zh-ct2 --quantization float16

# 转换英译中模型
ct2-transformers-converter --model Helsinki-NLP/opus-mt-en-zh --output_dir native/models/opus-mt-en-zh-ct2 --quantization float16
```

转换后的模型目录结构：
```
native/models/opus-mt-ja-zh-ct2/
├── model.bin
├── shared_vocabulary.json (或 source_vocabulary.json + target_vocabulary.json)
└── config.json
```

## 4. 编译项目

所有文件准备完成后，重新编译 native 模块：

```powershell
# 使用 electron-rebuild 编译
npx electron-rebuild

# 启动应用
npm start
```

## 5. 验证安装

启动应用后，查看控制台输出：

✅ 成功的输出：
```
[Native] Loading llwhisper with bindings...
[Native] ✓ llwhisper loaded
[Native] Loading translation model from: F:\GitProject\LLExtTool\native\models\opus-mt-ja-zh-ct2
[Translate] Loading model from: F:\GitProject\LLExtTool\native\models\opus-mt-ja-zh-ct2
[Translate] Using device: cpu
[Translate] ✓ Model loaded successfully
[Native] ✓ Translation model loaded
```

❌ 如果出现错误：
- "ctranslate2.dll not found" → 检查 DLL 是否复制到 build/Release/
- "Model not found" → 检查模型路径是否正确
- "Translation model not loaded" → 检查模型格式是否正确

## 6. 测试翻译功能

在应用中：
1. 加载视频并完成转录
2. 点击"翻译所有"按钮
3. 查看翻译结果

控制台会输出：
```
[Translate] Batch translating 50 texts...
[Translate] Batch translation completed: 50 results
```

## 常见问题

### Q: 模型太大，下载慢怎么办？
A: 可以使用国内镜像：
```powershell
# 使用 Hugging Face 镜像
$env:HF_ENDPOINT = "https://hf-mirror.com"
git clone https://hf-mirror.com/Helsinki-NLP/opus-mt-ja-zh native/models/opus-mt-ja-zh
```

### Q: 需要 GPU 加速吗？
A: CTranslate2 支持 CUDA 加速，如果你的 GPU 有 CUDA 支持，可以修改 `ipc-handlers.ts`：
```typescript
llwhisper.loadTranslateModel(translateModelPath, 'cuda'); // 使用 GPU
```

### Q: 支持哪些语言对？
A: Helsinki-NLP 的 Opus-MT 支持大量语言对：
- ja-zh (日译中)
- en-zh (英译中)
- ko-zh (韩译中)
- ja-en (日译英)
- 更多请访问：https://huggingface.co/Helsinki-NLP

### Q: 翻译质量不好怎么办？
A: 可以调整参数：
```typescript
llwhisper.translateText(text, {
  beam_size: 8,        // 增加 beam size 提高质量（更慢）
  length_penalty: 0.5  // 调整长度惩罚
});
```

## 下一步

- [ ] 下载并安装 CTranslate2
- [ ] 准备翻译模型
- [ ] 编译项目
- [ ] 测试翻译功能
- [ ] （可选）切换到 GPU 加速
