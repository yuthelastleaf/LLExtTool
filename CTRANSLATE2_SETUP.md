# CTranslate2 翻译模块设置指南

## 当前状态

✅ **已完成:**
- CTranslate2 源代码已下载到 `native/ctranslate2-source/`
- 翻译功能 C++ 代码已实现 (`native/src/translate_wrapper.cpp`)
- llwhisper.node 已编译并包含翻译函数导出

❌ **缺失:**
- CTranslate2 编译后的库文件 (`ctranslate2.lib`, `ctranslate2.dll`)

## 解决方案

### 方案 1: 下载预编译版本（推荐，最快）

1. **访问 CTranslate2 发布页面:**
   ```
   https://github.com/OpenNMT/CTranslate2/releases
   ```

2. **下载 Windows x64 版本:**
   - 找到最新版本（如 v4.4.0）
   - 下载 `ctranslate2-*-windows-x64.zip`

3. **解压到项目目录:**
   ```
   解压后的目录结构应该是:
   native/ctranslate2/
   ├── bin/
   │   └── ctranslate2.dll
   ├── include/
   │   └── ctranslate2/
   │       └── translator.h
   └── lib/
       └── ctranslate2.lib
   ```

4. **验证安装:**
   ```bash
   node test-translate.js
   ```

### 方案 2: 使用 Conda 安装

```bash
# 安装 CTranslate2
conda install -c conda-forge ctranslate2

# 找到安装位置
conda list ctranslate2 -v

# 复制文件到项目
# 从 conda 环境复制:
# - include/ctranslate2/* -> native/ctranslate2/include/ctranslate2/
# - lib/ctranslate2.lib -> native/ctranslate2/lib/
# - bin/ctranslate2.dll -> native/ctranslate2/bin/
```

### 方案 3: 从源码编译（需要 CMake 和 Visual Studio）

```bash
cd native/ctranslate2-source

# 使用 CMake 配置
mkdir build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release -DBUILD_CLI=OFF

# 编译
cmake --build . --config Release

# 复制编译产物到 native/ctranslate2/
```

## 测试翻译模块

运行测试脚本检查所有组件:

```bash
node test-translate.js
```

### 预期输出:

```
=== 测试翻译模块加载 ===

1. 检查 CTranslate2 文件:
  ✓ translator.h: 存在
  ✓ ctranslate2.lib: 存在
  ✓ ctranslate2.dll: 存在

2. 加载 llwhisper.node 模块:
  ✓ llwhisper.node 加载成功

3. 检查翻译函数:
  ✓ loadTranslateModel: 可用
  ✓ translateText: 可用
  ✓ translateBatch: 可用

4. 测试加载翻译模型:
  ⚠ 未找到翻译模型
  (需要先下载翻译模型)
```

## 下载翻译模型

安装好 CTranslate2 后，还需要翻译模型文件。

### 推荐模型: OPUS-MT (日语→中文)

```bash
# 1. 下载 Hugging Face 模型
pip install transformers ctranslate2

# 2. 转换为 CTranslate2 格式
ct2-transformers-converter --model Helsinki-NLP/opus-mt-ja-zh \
  --output_dir native/models/opus-mt-ja-zh-ct2 \
  --quantization int8

# 3. 或使用其他模型
# NLLB-200 (支持多语言)
ct2-transformers-converter --model facebook/nllb-200-distilled-600M \
  --output_dir native/models/nllb-200-ct2
```

## 项目集成

安装完成后，应用可以使用以下功能:

```javascript
const llwhisper = require('./build/Release/llwhisper.node');

// 加载模型
llwhisper.loadTranslateModel('native/models/opus-mt-ja-zh-ct2', 'cpu');

// 单句翻译
const result = llwhisper.translateText('こんにちは');
console.log(result); // 输出: 你好

// 批量翻译
const results = llwhisper.translateBatch([
  'こんにちは',
  'ありがとう',
  'さようなら'
]);
console.log(results); // ['你好', '谢谢', '再见']
```

## 常见问题

### Q: 为什么需要 CTranslate2？
A: CTranslate2 是高性能的神经机器翻译推理引擎，专为生产环境优化，比原始 PyTorch/TensorFlow 模型快 4-10 倍。

### Q: 可以使用 GPU 加速吗？
A: 可以！如果安装了 CUDA 版本的 CTranslate2，在加载模型时指定 `'cuda'` 设备即可。

### Q: 模型文件很大吗？
A: OPUS-MT 模型约 300MB，量化后约 150MB。NLLB 模型较大，约 1-2GB。

## 下一步

1. 按照上述方案安装 CTranslate2
2. 运行 `node test-translate.js` 验证
3. 下载并转换翻译模型
4. 在应用中启用翻译功能
