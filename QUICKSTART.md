# LLExtTool 快速启动指南

本指南帮助您快速设置并运行 LLExtTool。

## ⚡ 快速开始（5 分钟）

### 步骤 1: 安装 Node.js 依赖

```powershell
npm install
```

### 步骤 2: 下载 FFmpeg（必需）

1. 访问: https://github.com/BtbN/FFmpeg-Builds/releases
2. 下载: `ffmpeg-master-latest-win64-gpl-shared.zip`
3. 解压到项目根目录
4. 将解压后的文件夹重命名为 `ffmpeg`
5. 移动到 `native/` 目录下

最终结构应为：
```
native/
└── ffmpeg/
    ├── bin/
    ├── include/
    └── lib/
```

### 步骤 3: 编译 Whisper.cpp（必需）

**前置要求：**
- CMake (https://cmake.org/download/)
- Visual Studio Build Tools

```powershell
cd native
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
mkdir build
cd build
cmake ..
cmake --build . --config Release
cd ..\..\..
```

### 步骤 4: 下载 Whisper 模型（必需）

从 https://huggingface.co/ggerganov/whisper.cpp/tree/main 下载：

**推荐下载 base 模型（快速开始）：**
```powershell
# 创建模型目录
mkdir models\whisper

# 下载模型（使用浏览器或 curl）
# 访问上面的链接，下载 ggml-base.bin
# 将文件放到 models\whisper\ 目录
```

### 步骤 5: 编译 Native 模块

```powershell
npm run build:native
```

如果失败，请检查：
- ✅ Visual Studio Build Tools 已安装
- ✅ Python 3.x 已安装
- ✅ FFmpeg 和 Whisper.cpp 在正确位置

### 步骤 6: 编译 TypeScript

```powershell
npm run build
```

### 步骤 7: 启动应用

```powershell
npm start
```

或开发模式（自动重新编译）：
```powershell
npm run dev
```

## 🎯 首次使用

1. 点击右上角 "⚙️ 设置" 按钮
2. 设置 Whisper 模型路径：`models/whisper/ggml-base.bin`
3. 设置输出目录（可选）
4. 点击 "保存"
5. 点击 "选择" 按钮选择一个测试视频
6. 选择源语言（日语或英语）
7. 点击 "开始处理"

## 📋 检查清单

运行前确保：

- [ ] Node.js >= 18 已安装
- [ ] `npm install` 完成
- [ ] FFmpeg 在 `native/ffmpeg/` 目录
- [ ] Whisper.cpp 已编译，在 `native/whisper.cpp/build/` 目录
- [ ] Whisper 模型已下载到 `models/whisper/`
- [ ] `npm run build:native` 成功
- [ ] `npm run build` 成功
- [ ] `build/Release/llvideo.node` 存在
- [ ] `build/Release/llwhisper.node` 存在

## ❌ 常见问题

### "Cannot find module 'electron'"

```powershell
npm install
```

### "找不到 llvideo.node"

```powershell
npm run build:native
```

检查 `build/Release/` 目录是否有 `.node` 文件。

### "Failed to load model"

1. 确保模型文件路径正确
2. 模型文件完整下载（不是部分下载）
3. 在设置中重新指定模型路径

### "node-gyp 编译失败"

确保已安装：
1. Visual Studio Build Tools 2019+
2. Python 3.x
3. Windows SDK

安装 VS Build Tools:
```powershell
# 使用管理员权限运行
npm install --global windows-build-tools
```

### "CMake 找不到"

下载安装 CMake: https://cmake.org/download/

安装后确保添加到 PATH。

### 应用启动但功能不工作

1. 打开开发者工具（应用会自动打开）
2. 查看 Console 中的错误信息
3. 检查 Native 模块是否正确加载

## 🔧 开发模式

使用开发模式可以自动重新编译：

```powershell
# 终端 1: 监听 TypeScript 变化
npm run watch

# 终端 2: 运行 Electron
npm start
```

或使用一个命令：
```powershell
npm run dev
```

## 📦 打包应用

```powershell
npm run package
```

打包后的应用在 `release/` 目录。

## 🆘 获取帮助

如果遇到问题：

1. 查看 `DEVELOPMENT.md` - 详细开发指南
2. 查看 `NATIVE_INTEGRATION.md` - C++ 模块集成
3. 查看 `TRANSLATION_GUIDE.md` - 翻译功能配置
4. 提交 Issue 到 GitHub

## 🎉 开始使用

现在您可以：

1. 选择视频文件
2. 自动提取音频
3. 语音识别成文字
4. 翻译成中文
5. 编辑字幕和分配说话人
6. 导出 SRT/VTT 字幕文件

享受使用 LLExtTool！
