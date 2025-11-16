# LLExtTool - 视频字幕提取和翻译工具

一个基于 Electron 的桌面应用，集成 FFmpeg、Whisper.cpp 和翻译模型，用于视频音频提取、语音识别和字幕翻译。

## 功能特性

- 🎬 **视频音频提取**: 使用 FFmpeg 将视频转换为 WAV 或其他音频格式
- 🎙️ **语音识别**: 集成 Whisper.cpp 进行本地语音转文字（支持日语、英语）
- 🌐 **智能翻译**: 将日语/英语字幕翻译成中文
- 📝 **字幕编辑器**: 支持查看、编辑和修正识别结果
- 👥 **说话人分类**: 手动为字幕分配说话人标签
- 💾 **本地模型**: 所有模型本地加载，保护隐私

## 项目结构

```
LLExtTool/
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── main.ts
│   │   ├── ipc-handlers.ts
│   │   └── config-manager.ts
│   ├── renderer/       # 渲染进程（UI）
│   │   ├── index.html
│   │   ├── renderer.ts
│   │   ├── styles/
│   │   └── components/
│   ├── shared/         # 共享类型定义
│   │   └── types.ts
│   └── services/       # 业务逻辑
│       ├── video-processor.ts
│       ├── whisper-service.ts
│       └── translator.ts
├── native/             # C++ Native 模块
│   ├── src/
│   │   ├── llvideo.cpp
│   │   ├── llwhisper.cpp
│   │   ├── ffmpeg_wrapper.cpp
│   │   └── whisper_wrapper.cpp
│   ├── include/
│   ├── ffmpeg/         # FFmpeg 库（需要下载）
│   └── whisper.cpp/    # Whisper.cpp（需要克隆）
├── models/             # 模型文件目录
│   ├── whisper/        # Whisper 模型
│   └── translation/    # 翻译模型
├── binding.gyp         # Node.js C++ 扩展构建配置
├── package.json
└── tsconfig.json
```

## 快速开始

### 自动安装（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/yuthelastleaf/LLExtTool.git
cd LLExtTool

# 2. 安装 Node.js 依赖
npm install

# 3. 自动下载和配置 FFmpeg 与 Whisper（一键完成）
npm run setup

# 4. 编译 Native 模块
npm run build:native

# 5. 构建并运行
npm run build
npm start
```

### 手动安装

如果自动安装失败，可以手动配置：

#### FFmpeg
```bash
# 下载 FFmpeg
npm run setup:ffmpeg

# 或手动下载
# 1. 访问: https://github.com/BtbN/FFmpeg-Builds/releases
# 2. 下载: ffmpeg-n7.1-latest-win64-lgpl-shared-7.1.zip
# 3. 解压到: native/ffmpeg/
```

#### Whisper.cpp
```bash
# 下载并编译 Whisper
npm run setup:whisper

# 或手动操作
cd native
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

## 环境要求

- Node.js >= 18
- Python 3.x (node-gyp 需要)
- Visual Studio Build Tools (Windows)
- CMake (用于编译 Whisper.cpp)

## 安装步骤

### 1. 安装依赖

```powershell
npm install
```

### 2. 准备 FFmpeg

下载 FFmpeg shared builds 并解压到 `native/ffmpeg/` 目录：
- 下载地址: https://github.com/BtbN/FFmpeg-Builds/releases
- 需要包含 `include/`, `lib/`, `bin/` 目录

### 3. 编译 Whisper.cpp

```powershell
cd native
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
mkdir build
cd build
cmake ..
cmake --build . --config Release
```

### 4. 下载 Whisper 模型

```powershell
# 在 models/whisper/ 目录下
# 下载模型文件，例如：
# ggml-base.bin, ggml-small.bin 等
```

从 https://huggingface.co/ggerganov/whisper.cpp 下载

### 5. 编译 Native 模块

```powershell
npm run build:native
```

### 6. 编译并运行

```powershell
npm run dev
```

## 使用说明

1. **配置模型路径**: 首次运行需要在设置中配置 Whisper 模型路径
2. **选择视频文件**: 点击"选择视频"按钮选择要处理的视频文件
3. **设置参数**: 选择源语言（日语/英语）和目标语言（中文）
4. **开始处理**: 点击"开始处理"，工具会自动：
   - 提取音频
   - 语音识别
   - 翻译字幕
5. **编辑字幕**: 在字幕编辑器中查看和修改结果
6. **导出**: 导出为 SRT 或其他字幕格式

## Native 模块接口

### LLVideo (FFmpeg 封装)

```typescript
interface LLVideo {
  extractAudio(videoPath: string, outputPath: string, format: 'wav' | 'mp3'): Promise<void>;
  getVideoInfo(videoPath: string): Promise<VideoInfo>;
}
```

### LLWhisper (Whisper.cpp 封装)

```typescript
interface LLWhisper {
  loadModel(modelPath: string): Promise<void>;
  transcribe(audioPath: string, language: 'ja' | 'en'): Promise<TranscriptSegment[]>;
}
```

## 开发说明

- C++ 模块位于 `native/` 目录
- TypeScript 编译输出到 `dist/` 目录
- 使用 IPC 进行主进程和渲染进程通信
- 配置文件存储在用户目录

## 待完善功能

- [ ] 实时处理进度显示
- [ ] 批量处理多个视频
- [ ] 更多翻译模型支持
- [ ] 字幕时间轴调整
- [ ] 导出多种字幕格式
- [ ] 自动说话人分离（实验性）

## 许可证

MIT License
