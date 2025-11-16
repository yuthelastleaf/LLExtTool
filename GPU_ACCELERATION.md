# Whisper GPU 加速配置指南

## 概述

Whisper.cpp 支持多种 GPU 加速方式:
- **CUDA** (NVIDIA GPU)
- **OpenCL** (AMD/Intel/通用)
- **Metal** (macOS)
- **Vulkan** (跨平台)

## 当前状态

❌ **当前编译版本使用 CPU**
- 编译时未启用 GPU 支持
- 使用多线程 CPU 处理 (8 线程)

## 如何启用 GPU 加速

### 方案 A: CUDA (NVIDIA GPU - 推荐)

#### 前提条件
1. NVIDIA GPU (支持 CUDA)
2. 安装 CUDA Toolkit (11.x 或 12.x)
3. 安装 cuDNN

#### 编译步骤

```powershell
# 1. 进入 whisper.cpp 目录
cd native\whisper.cpp

# 2. 清理之前的构建
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue

# 3. 配置 CMake (启用 CUDA)
cmake -B build `
  -DGGML_CUDA=ON `
  -DCUDA_ARCHITECTURES=native `
  -DWHISPER_BUILD_EXAMPLES=OFF

# 4. 编译
cmake --build build --config Release

# 5. 返回项目根目录并重新构建
cd ..\..
npm run build:native
```

#### 验证 GPU 是否启用
```javascript
// whisper.cpp 会自动检测并使用 GPU
// 查看输出中是否有 "using CUDA" 或类似信息
```

---

### 方案 B: OpenCL (AMD/Intel GPU)

```powershell
cd native\whisper.cpp
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue

cmake -B build `
  -DGGML_CLBLAST=ON `
  -DWHISPER_BUILD_EXAMPLES=OFF

cmake --build build --config Release
cd ..\..
npm run build:native
```

---

### 方案 C: Vulkan (跨平台)

```powershell
cd native\whisper.cpp
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue

cmake -B build `
  -DGGML_VULKAN=ON `
  -DWHISPER_BUILD_EXAMPLES=OFF

cmake --build build --config Release
cd ..\..
npm run build:native
```

---

## 性能对比

### CPU (当前)
- **速度**: 1x-2x 实时 (取决于 CPU)
- **large-v2 模型**: 约 5-10 分钟/小时音频
- **优点**: 无需额外配置
- **缺点**: 较慢,占用 CPU

### GPU (CUDA)
- **速度**: 5x-15x 实时
- **large-v2 模型**: 约 30-120 秒/小时音频
- **优点**: 快速,不占用 CPU
- **缺点**: 需要 NVIDIA GPU 和 CUDA

### GPU (OpenCL)
- **速度**: 2x-5x 实时
- **large-v2 模型**: 约 2-5 分钟/小时音频
- **优点**: 支持更多 GPU
- **缺点**: 性能不如 CUDA

---

## 检查你的 GPU

### Windows
```powershell
# 检查 NVIDIA GPU
nvidia-smi

# 检查 CUDA 版本
nvcc --version

# 检查所有 GPU
Get-WmiObject Win32_VideoController | Select-Object Name, DriverVersion
```

### 输出示例
```
Name                          DriverVersion
----                          -------------
NVIDIA GeForce RTX 3060       31.0.15.3623
Intel(R) UHD Graphics 630     27.20.100.8681
```

---

## 实时输出问题

### 原因
Whisper.cpp 的进度输出写入 `stderr`,Node.js 的 Native 模块默认不会转发这些输出。

### 解决方案

#### 方案 1: 添加进度回调 (需要修改 C++ 代码)

在 `whisper_wrapper.cpp` 中添加进度回调:

```cpp
// 进度回调函数
static bool progress_callback(
    struct whisper_context* ctx,
    struct whisper_state* state,
    int progress,
    void* user_data
) {
    // 通过某种方式通知 JavaScript
    printf("Progress: %d%%\n", progress);
    fflush(stdout);
    return true;
}

// 在 transcribe() 中设置回调
wparams.encoder_begin_callback = progress_callback;
wparams.encoder_begin_callback_user_data = nullptr;
```

#### 方案 2: 使用较小的模型测试

```javascript
// 使用 small 或 base 模型更快
modelPath: 'native/whisper.cpp/models/ggml-small.bin'  // 约 30 秒/小时音频
modelPath: 'native/whisper.cpp/models/ggml-base.bin'   // 约 10 秒/小时音频
```

#### 方案 3: 先测试短音频

```javascript
// 提取前 30 秒
llvideo.extractAudio(videoPath, audioPath, 'wav', {
  start: 0,
  duration: 30
});
```

---

## 推荐配置

### 如果有 NVIDIA GPU
```bash
# 启用 CUDA
cd native\whisper.cpp
cmake -B build -DGGML_CUDA=ON -DCUDA_ARCHITECTURES=native
cmake --build build --config Release
```

### 如果没有 NVIDIA GPU
1. 使用较小的模型 (small/base)
2. 增加 CPU 线程数: `n_threads: 12` (根据你的 CPU 核心数)
3. 考虑使用 `ggml-medium.bin` 作为平衡点

---

## 测试 GPU 加速

```javascript
// test-e2e.js
const config = {
  modelPath: 'native/whisper.cpp/models/ggml-small.bin',  // 先用小模型测试
  params: {
    n_threads: 4,
    use_gpu: true
  }
};
```

---

## 故障排除

### 编译错误: "CUDA not found"
- 确保安装了 CUDA Toolkit
- 将 CUDA 路径添加到 PATH: `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.x\bin`

### 运行时错误: "CUDA driver version insufficient"
- 更新 NVIDIA 显卡驱动
- 或降级 CUDA Toolkit 版本

### 性能没有提升
- 检查是否真的使用了 GPU: 运行时查看 GPU 占用率
- 确认 whisper.dll 是用 GPU 编译的
- 尝试重新编译并确保看到 "CUDA enabled" 或类似消息

---

*最后更新: 2025-11-16*
