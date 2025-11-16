# LLExtTool Native 模块集成问题汇总

## 项目概述

**目标**: 为 Electron 应用创建 FFmpeg 和 Whisper.cpp 的 Native 模块封装

**技术栈**:
- Electron 27.3.11 (Node.js 18.17.1)
- FFmpeg 7.1 (BtbN shared builds)
- Whisper.cpp (master branch with GGML)
- CMake + cmake-js
- Visual Studio 2022 (MSVC 19.44)
- Node-API (NAPI)

---

## 遇到的问题及解决方案

### 问题 1: CMake 找不到 Node.js 头文件

**错误表现**:
```
CMake Error: CMAKE_JS_INC not defined
```

**根本原因**: 
- 直接使用 `cmake` 命令而不是 `cmake-js`
- cmake-js 负责下载和配置 Node.js/Electron 的头文件

**解决方案**:
```bash
# ❌ 错误方式
cmake -B build
cmake --build build --config Release

# ✅ 正确方式
npx cmake-js rebuild --runtime=electron --runtime-version=27.3.11 --arch=x64
```

---

### 问题 2: AVChannelLayout 初始化导致编译错误

**错误表现**:
```cpp
error C2440: '=': cannot convert from 'initializer list' to 'AVChannelLayout'
```

**根本原因**: 
- FFmpeg 6.0+ 使用新的 `AVChannelLayout` 结构
- MSVC 不支持 C99 指定初始化器 (designated initializers)

**解决方案**:
```cpp
// ❌ 错误 (C99 语法)
AVChannelLayout ch_layout = {
    .order = AV_CHANNEL_ORDER_NATIVE,
    .nb_channels = codec_ctx->ch_layout.nb_channels
};

// ✅ 正确 (C++ 兼容)
AVChannelLayout ch_layout;
av_channel_layout_default(&ch_layout, codec_ctx->ch_layout.nb_channels);
```

---

### 问题 3: Whisper 参数结构不匹配

**错误表现**:
```cpp
error: 'struct whisper_full_params' has no member named 'best_of'
error: 'struct whisper_full_params' has no member named 'beam_size'
```

**根本原因**: 
- whisper.h 中参数结构已更新
- `best_of` 移到 `wparams.greedy.best_of`
- `beam_size` 移到 `wparams.beam_search.beam_size`

**解决方案**:
```cpp
// ❌ 错误 (旧 API)
wparams.best_of = params.best_of;
wparams.beam_size = params.beam_size;

// ✅ 正确 (新 API)
wparams.greedy.best_of = params.best_of;
wparams.beam_search.beam_size = params.beam_size;
```

---

### 问题 4: Native 模块路径不匹配

**错误表现**:
```
Error: Cannot find module '../../build/Release/llvideo.node'
```

**根本原因**: 
- CMake 输出到 `build/bin/Release/`
- ipc-handlers.ts 引用的是 `build/Release/`

**解决方案**:
创建 `native-loader.ts` 统一管理路径:

```typescript
export function getNativeModulePath(moduleName: 'llvideo' | 'llwhisper'): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 
                     'build', 'bin', 'Release', `${moduleName}.node`);
  } else {
    return path.join(app.getAppPath(), 'build', 'bin', 'Release', 
                     `${moduleName}.node`);
  }
}
```

---

### 问题 5: Electron 版本不匹配导致模块加载失败

**错误表现**:
```
[ERROR:crashpad_client_win.cc(863)] not connected
exit code: 429493043 (0x199A0013)
```

**症状**:
- ✅ 在普通 Node.js (v22.20.0) 中可以正常加载
- ❌ 在 Electron 中加载时立即崩溃
- 模块用一个版本编译,运行时是另一个版本

**根本原因**:
1. **package.json 中声明的版本 vs 实际安装的版本不一致**
   - package.json: `"electron": "^27.1.3"` (允许更新到 27.x)
   - 实际安装: `v27.3.11`
   - Native 模块用 27.1.3 编译,但运行时是 27.3.11

2. **构建路径不一致**
   - cmake-js 输出到 `build/bin/Release/`
   - electron-rebuild 输出到 `build/Release/`
   - 代码中路径硬编码,导致找不到模块

**解决方案**:

#### 5.1 锁定 Electron 版本 ✅

```json
// package.json - 使用精确版本
{
  "devDependencies": {
    "electron": "27.3.11"  // ❌ 不要用 ^27.1.3
  }
}
```

#### 5.2 使用正确的 Electron 版本重新编译
```bash
# 检查实际安装的版本
node node_modules\electron\cli.js --version

# 用正确的版本编译
node node_modules/cmake-js/bin/cmake-js rebuild --runtime=electron --runtime-version=27.3.11 --arch=x64 --out=build
```

#### 5.3 使用 bindings 包加载模块 ✅
参考成功的项目 (LLAlpcEditor),使用标准的 `bindings` 包:

```bash
npm install --save bindings
npm install --save-dev electron-rebuild
```

```typescript
// native-loader.ts
function tryBindings(moduleName: string): any | null {
  try {
    const bindings = require('bindings');
    return bindings(moduleName);
  } catch (error) {
    return null;
  }
}
```

#### 5.4 自动检测构建路径 ✅
支持多种构建工具的输出路径:

```typescript
export function getNativeModuleDir(): string {
  // Try both cmake-js path (build/bin/Release) and node-gyp path (build/Release)
  const cmakePath = path.join(app.getAppPath(), 'build', 'bin', 'Release');
  const gypPath = path.join(app.getAppPath(), 'build', 'Release');
  
  if (fs.existsSync(cmakePath)) {
    return cmakePath;
  } else if (fs.existsSync(gypPath)) {
    return gypPath;
  }
  return cmakePath;
}
```

---

### 问题 6: 构建目录路径不一致

**错误表现**:
```
Error: ENOENT: no such file or directory, scandir 'F:\GitProject\LLExtTool\build\bin\Release'
```

**根本原因**:
- **cmake-js**: 输出到 `build/bin/Release/`
- **electron-rebuild**: 输出到 `build/Release/`
- 代码期望 `build/bin/Release/`,但实际文件在 `build/Release/`

**解决方案**:

#### 6.1 检查实际构建输出位置
```powershell
Get-ChildItem build -Recurse -Directory
```

#### 6.2 复制 DLL 到正确位置
```powershell
# 复制 FFmpeg DLL
Copy-Item native\ffmpeg\bin\*.dll build\Release\ -Force

# 复制 Whisper/GGML DLL
Copy-Item native\whisper.cpp\build\bin\Release\*.dll build\Release\ -Force
```

#### 6.3 验证文件
```powershell
Get-ChildItem build\Release\*.node, build\Release\*.dll
```

应该看到:
- `llvideo.node`
- `llwhisper.node` 
- 11 个 DLL 文件 (FFmpeg + Whisper + GGML)

---

### 问题 7: 目录不存在导致启动失败

**错误表现**:
```
[DLL] Setup failed: Error: ENOENT: no such file or directory
App threw an error during load
```

**根本原因**:
`setupDllPath()` 在模块加载时立即执行,尝试读取可能不存在的目录

**解决方案**:
添加目录存在性检查:

```typescript
function setupDllPath(): void {
  const dllDir = getNativeModuleDir();
  
  // ✅ 检查目录是否存在
  if (!fs.existsSync(dllDir)) {
    console.warn('[DLL] Directory not found:', dllDir);
    console.warn('[DLL] Run: npm run build:native');
    return;  // 不抛出错误,让应用继续启动
  }
  
  // ... 继续设置路径
}
```

**DLL 依赖树**:
```
llvideo.node
├── avcodec-61.dll
│   ├── avutil-59.dll ✅
│   ├── swresample-5.dll ✅
│   ├── d2d1.dll ❓ (系统)
│   ├── DWrite.dll ❓ (系统)
│   └── api-ms-win-crt-*.dll ❓ (UCRT)
├── avformat-61.dll
│   └── avutil-59.dll ✅
├── avutil-59.dll ✅
└── swresample-5.dll ✅

llwhisper.node
├── whisper.dll ✅
├── (所有 FFmpeg DLL 同上)
```

---

## 当前状态

### ✅ 已完成
1. **FFmpeg C++ 封装** (`ffmpeg_wrapper.cpp`)
   - `extractAudio()`: 音频提取
   - `getVideoInfo()`: 获取视频信息
   - `isValidMediaFile()`: 验证媒体文件

2. **Whisper C++ 封装** (`whisper_wrapper.cpp`)
   - `loadModel()`: 加载模型
   - `transcribe()`: 转录音频
   - 支持完整 CLI 参数 (language, entropy_thold, logprob_thold, suppress_nst, etc.)
   - 5 种导出格式 (TXT, SRT, VTT, JSON, LRC)

3. **NAPI 绑定**
   - `llvideo.node`: 4 个导出函数
   - `llwhisper.node`: 7 个导出函数
   - ✅ 在 Node.js 中测试通过
   - ✅ 在 Electron 中可以加载

4. **TypeScript 类型定义**
   - `native/llvideo.d.ts`
   - `native/llwhisper.d.ts`

5. **CMake 构建系统**
   - 自动查找 FFmpeg 和 Whisper 库
   - 自动复制 DLL 到输出目录
   - 支持 Electron 和 Node.js 运行时

6. **模块加载优化**
   - `native-loader.ts`: 统一路径管理,支持多种构建路径
   - `native-module-cache.ts`: 延迟加载和缓存
   - DLL 路径自动设置
   - 使用 `bindings` 包标准加载方式
   - 错误处理和降级机制

7. **Electron 集成** ✅ **已解决!**
   - 版本锁定: Electron 27.3.11
   - 构建路径兼容: 支持 cmake-js 和 node-gyp
   - DLL 依赖管理: 自动添加到 PATH
   - 应用可以正常启动并选择文件

### ⏳ 进行中
1. **完整功能测试**
   - 需要测试音频提取功能
   - 需要测试 Whisper 转录功能
   - 需要测试各种导出格式

2. **Whisper 模型集成**
   - 模型下载脚本
   - 模型路径配置

### 📋 待完成
1. 翻译模型集成
2. electron-builder 打包配置
3. 性能优化
4. 错误处理完善
5. 用户文档

---

## 测试脚本

### 1. Node.js 环境测试 (✅ 通过)
```bash
node test-dll-load.js
node test-native.js
```

### 2. Electron 环境测试 (❌ 失败)
```bash
node node_modules\electron\cli.js test-electron-native.js
```

### 3. DLL 依赖检查
```bash
.\check-dependencies.bat
```

---

## 成功的关键因素

### 1. 版本精确匹配
```json
{
  "devDependencies": {
    "electron": "27.3.11",  // ✅ 精确版本,不用 ^
    "electron-rebuild": "^3.2.9"
  },
  "dependencies": {
    "bindings": "^1.5.0"  // ✅ 标准 Native 模块加载器
  }
}
```

### 2. 构建命令
```bash
# 用实际安装的 Electron 版本编译
node node_modules/cmake-js/bin/cmake-js rebuild \
  --runtime=electron \
  --runtime-version=27.3.11 \
  --arch=x64 \
  --out=build
```

### 3. DLL 部署
```powershell
# 确保所有 DLL 在正确位置
Copy-Item native\ffmpeg\bin\*.dll build\Release\ -Force
Copy-Item native\whisper.cpp\build\bin\Release\*.dll build\Release\ -Force
```

### 4. 灵活的路径处理
```typescript
// 支持多种构建工具
function getNativeModuleDir(): string {
  const cmakePath = path.join(app.getAppPath(), 'build', 'bin', 'Release');
  const gypPath = path.join(app.getAppPath(), 'build', 'Release');
  return fs.existsSync(cmakePath) ? cmakePath : gypPath;
}
```

### 5. 优雅的错误处理
```typescript
// 目录不存在时不要崩溃
if (!fs.existsSync(dllDir)) {
  console.warn('[DLL] Directory not found');
  return;  // 继续启动应用
}
```

---

## 编译命令汇总

### 完整重新编译
```bash
# 清理
Remove-Item -Recurse -Force build\cmake -ErrorAction SilentlyContinue

# 编译 (使用 Electron 27.3.11)
node node_modules/cmake-js/bin/cmake-js rebuild --runtime=electron --runtime-version=27.3.11 --arch=x64 --out=build

# 或使用脚本
npm run build:native
```

### 仅编译 Whisper.cpp
```bash
cd native\whisper.cpp
cmake -B build -DGGML_NATIVE=OFF -DWHISPER_BUILD_EXAMPLES=OFF
cmake --build build --config Release
```

---

## 关键文件路径

```
LLExtTool/
├── native/
│   ├── include/
│   │   ├── ffmpeg_wrapper.h
│   │   └── whisper_wrapper.h
│   ├── src/
│   │   ├── llvideo.cpp           # FFmpeg NAPI 绑定
│   │   ├── llwhisper.cpp         # Whisper NAPI 绑定
│   │   ├── ffmpeg_wrapper.cpp
│   │   └── whisper_wrapper.cpp
│   ├── ffmpeg/                   # FFmpeg 7.1 shared builds
│   │   ├── bin/*.dll
│   │   ├── include/
│   │   └── lib/
│   └── whisper.cpp/              # Whisper.cpp 源码
│       └── build/bin/Release/*.dll
│
├── build/
│   └── bin/Release/              # 输出目录
│       ├── llvideo.node
│       ├── llwhisper.node
│       └── *.dll (11 个)
│
├── src/main/
│   ├── native-loader.ts          # 模块路径管理
│   ├── native-module-cache.ts    # 延迟加载
│   └── ipc-handlers.ts           # IPC 处理
│
└── CMakeLists.txt                # 构建配置
```

---

## 参考资源

1. **FFmpeg 下载**: https://github.com/BtbN/FFmpeg-Builds/releases
2. **Whisper.cpp**: https://github.com/ggerganov/whisper.cpp
3. **cmake-js 文档**: https://github.com/cmake-js/cmake-js
4. **Node-API 文档**: https://nodejs.org/api/n-api.html
5. **Electron Native 模块**: https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules

---

## 联系与贡献

**项目**: LLExtTool - 视频字幕提取和翻译工具  
**开发者**: yuthelastleaf  
**状态**: 🚧 开发中 - Native 模块集成阻塞

---

## 经验教训

### ✅ 正确做法
1. **参考成功案例**: LLAlpcEditor 项目使用 `bindings` 包,证明是可行的方案
2. **版本锁定**: Native 模块对版本极其敏感,必须精确匹配
3. **路径灵活性**: 不同构建工具有不同的输出路径约定
4. **错误容错**: 启动时不要因为 Native 模块缺失而崩溃
5. **调试工具**: dumpbin 检查依赖,bindings 标准加载

### ❌ 避免的坑
1. **不要使用 `^` 版本范围** - Native 模块需要精确版本
2. **不要硬编码路径** - 支持多种构建工具的输出
3. **不要在顶层直接执行** - 目录检查应该在函数内,而非模块加载时
4. **不要忽略构建输出** - 注意 cmake-js vs electron-rebuild 的差异
5. **不要跳过依赖检查** - 确保所有 DLL 都正确部署

### 🔍 调试技巧
1. **检查版本一致性**:
   ```bash
   node --version  # 系统 Node.js
   node node_modules\electron\cli.js --version  # Electron 版本
   node -p "process.versions.node"  # 运行时 Node.js
   ```

2. **检查模块依赖**:
   ```bash
   dumpbin /dependents build\Release\llvideo.node
   ```

3. **测试加载**:
   ```javascript
   // 先在普通 Node.js 中测试
   node test-dll-load.js
   
   // 再在 Electron 中测试
   node node_modules\electron\cli.js test-electron-native.js
   ```

4. **路径诊断**:
   ```javascript
   console.log('App path:', app.getAppPath());
   console.log('Module dir:', getNativeModuleDir());
   console.log('Exists:', fs.existsSync(modulePath));
   ```

---

## 总结

Native 模块集成到 Electron 是一个复杂的过程,主要挑战在于:
- **版本匹配**: Electron 版本、Node.js ABI、编译器版本必须完全一致
- **路径管理**: 不同构建系统有不同的约定
- **依赖部署**: Windows DLL 搜索路径机制复杂
- **错误处理**: 需要优雅降级,不能因 Native 模块而阻塞应用启动

通过参考成功案例(LLAlpcEditor)、精确版本控制、灵活路径处理和完善的错误处理,最终成功解决了所有问题。

---

*最后更新: 2025-11-16 11:57*  
*状态: ✅ Native 模块集成成功!*
