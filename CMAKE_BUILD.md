# CMake 构建指南

## 概述

本项目使用 CMake 来编译 Native C++ 模块，相比 node-gyp 更加灵活和强大。

## 前置要求

### 1. 安装 CMake

**Windows:**
```powershell
# 使用 Chocolatey
choco install cmake

# 或者从官网下载安装
# https://cmake.org/download/
```

**验证安装:**
```powershell
cmake --version
```

### 2. 安装 Visual Studio

需要 Visual Studio 2022（或 2019）的 C++ 工具：
- 打开 Visual Studio Installer
- 安装 "使用 C++ 的桌面开发"
- 确保勾选 "MSVC v143" 和 "Windows 10/11 SDK"

### 3. 准备依赖库

#### FFmpeg
```bash
# 下载 FFmpeg shared 版本
# https://github.com/BtbN/FFmpeg-Builds/releases

# 解压到项目目录
native/ffmpeg/
  ├── bin/          # DLL 文件
  ├── include/      # 头文件
  └── lib/          # 链接库
```

#### Whisper.cpp
```bash
# 克隆并编译 whisper.cpp
cd native
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# 使用 CMake 编译
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release

# 生成的文件在 build/bin/Release/
```

## 构建命令

### 快速构建

```bash
# 一键构建（推荐）
npm run build:native
```

### 手动构建步骤

```bash
# 1. 配置 CMake
cmake -S . -B build/cmake -G "Visual Studio 17 2022" -A x64

# 2. 编译
cmake --build build/cmake --config Release

# 3. 安装（复制 .node 文件到 build/Release）
cmake --install build/cmake --config Release
```

### 清理构建

```bash
# 清理所有构建输出
npm run clean

# 或手动删除
Remove-Item -Recurse -Force build, dist
```

## 项目结构

```
LLExtTool/
├── CMakeLists.txt              # 主 CMake 配置
├── native/
│   ├── include/                # C++ 头文件
│   │   ├── ffmpeg_wrapper.h
│   │   └── whisper_wrapper.h
│   ├── src/                    # C++ 源文件
│   │   ├── llvideo.cpp        # FFmpeg NAPI 绑定
│   │   ├── llwhisper.cpp      # Whisper NAPI 绑定
│   │   ├── ffmpeg_wrapper.cpp
│   │   └── whisper_wrapper.cpp
│   ├── ffmpeg/                 # FFmpeg 库（需下载）
│   └── whisper.cpp/            # Whisper 库（需编译）
├── build/
│   ├── cmake/                  # CMake 构建输出
│   └── Release/                # 最终 .node 文件
│       ├── llvideo.node
│       ├── llwhisper.node
│       └── *.dll               # 依赖的 DLL
└── scripts/
    └── build-native.js         # 构建脚本
```

## CMakeLists.txt 说明

### 主要功能

1. **自动检测 Node-API 路径**
   ```cmake
   execute_process(
       COMMAND node -p "require('node-addon-api').include"
       OUTPUT_VARIABLE NODE_ADDON_API_DIR
   )
   ```

2. **配置两个独立的模块**
   - `llvideo.node` - FFmpeg 封装
   - `llwhisper.node` - Whisper 封装

3. **自动复制依赖 DLL**
   - FFmpeg DLL 文件
   - Whisper DLL 文件
   - 复制到 `build/Release/` 目录

4. **兼容 node-gyp 目录结构**
   - 输出到 `build/Release/`
   - Electron 可以直接使用 `require()` 加载

### 关键配置

```cmake
# FFmpeg 路径
set(FFMPEG_ROOT "${CMAKE_SOURCE_DIR}/native/ffmpeg")

# Whisper 路径
set(WHISPER_ROOT "${CMAKE_SOURCE_DIR}/native/whisper.cpp")

# 输出为 .node 文件
set_target_properties(llvideo PROPERTIES
    PREFIX ""
    SUFFIX ".node"
)
```

## 常见问题

### 1. CMake 找不到 Visual Studio

**错误:** `Could not find a valid Visual Studio instance`

**解决:**
```bash
# 指定 Visual Studio 版本
cmake -G "Visual Studio 17 2022" -A x64 -S . -B build/cmake

# 或使用 Visual Studio 2019
cmake -G "Visual Studio 16 2019" -A x64 -S . -B build/cmake
```

### 2. 找不到 FFmpeg 库

**错误:** `Cannot find -lavcodec`

**解决:**
- 检查 `native/ffmpeg/lib/` 目录是否存在
- 确保下载的是 **shared** 版本（包含 .lib 和 .dll）
- 更新 CMakeLists.txt 中的 `FFMPEG_ROOT` 路径

### 3. 找不到 Whisper 库

**警告:** `Whisper library not found`

**解决:**
```bash
# 编译 whisper.cpp
cd native/whisper.cpp
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release

# 验证输出
ls build/bin/Release/whisper.dll
```

### 4. Node 模块加载失败

**错误:** `Error: The specified module could not be found`

**解决:**
- 确保所有 DLL 文件都在 `build/Release/` 目录
- 检查 DLL 依赖: `dumpbin /dependents build/Release/llvideo.node`
- 使用 [Dependency Walker](http://www.dependencywalker.com/) 检查缺失的依赖

## 调试技巧

### 1. 查看详细编译输出

```bash
cmake --build build/cmake --config Release --verbose
```

### 2. 测试模块加载

```javascript
// test-native.js
try {
  const llvideo = require('./build/Release/llvideo.node');
  console.log('✓ llvideo loaded:', Object.keys(llvideo));
} catch (error) {
  console.error('✗ llvideo failed:', error.message);
}

try {
  const llwhisper = require('./build/Release/llwhisper.node');
  console.log('✓ llwhisper loaded:', Object.keys(llwhisper));
} catch (error) {
  console.error('✗ llwhisper failed:', error.message);
}
```

### 3. 检查 DLL 依赖

```powershell
# 使用 dumpbin（Visual Studio 工具）
dumpbin /dependents build\Release\llvideo.node

# 或使用 PowerShell
Get-Item build\Release\*.dll | Select-Object Name, Length
```

## 性能优化

### Release 构建优化

CMakeLists.txt 中已启用:
- C++17 标准
- Release 模式编译
- 链接时优化（如果编译器支持）

### 自定义优化选项

```cmake
# 添加到 CMakeLists.txt
if(MSVC)
    target_compile_options(llvideo PRIVATE /O2 /GL)
    target_link_options(llvideo PRIVATE /LTCG)
endif()
```

## 与 node-gyp 的对比

| 特性 | node-gyp | CMake |
|-----|----------|-------|
| 配置语法 | Python-like | CMake DSL |
| 跨平台支持 | 好 | 优秀 |
| IDE 支持 | 有限 | 优秀 |
| 构建速度 | 中等 | 快 |
| 调试支持 | 基础 | 强大 |
| 大型项目 | 不便 | 便利 |

## 进阶使用

### 条件编译

```cmake
# 仅在 FFmpeg 可用时编译 llvideo
if(EXISTS "${FFMPEG_ROOT}/lib/avcodec.lib")
    add_library(llvideo SHARED ...)
endif()
```

### 多配置构建

```bash
# Debug 构建
cmake --build build/cmake --config Debug

# Release 构建
cmake --build build/cmake --config Release
```

### 添加测试

```cmake
enable_testing()
add_test(NAME LoadModule
    COMMAND node -e "require('./build/Release/llvideo.node')"
)
```

## 参考资源

- [CMake 官方文档](https://cmake.org/documentation/)
- [Node-API 文档](https://nodejs.org/api/n-api.html)
- [node-addon-api 指南](https://github.com/nodejs/node-addon-api)
- [FFmpeg 文档](https://ffmpeg.org/documentation.html)
- [Whisper.cpp](https://github.com/ggerganov/whisper.cpp)
