# 开发指南

## 快速开始

### 1. 安装依赖

```powershell
npm install
```

### 2. 准备环境

#### 下载 FFmpeg
1. 访问 https://github.com/BtbN/FFmpeg-Builds/releases
2. 下载 `ffmpeg-master-latest-win64-gpl-shared.zip`
3. 解压到 `native/ffmpeg/` 目录

#### 编译 Whisper.cpp
```powershell
cd native
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
mkdir build
cd build
cmake ..
cmake --build . --config Release
cd ../../..
```

#### 下载 Whisper 模型
创建 `models/whisper/` 目录，从 https://huggingface.co/ggerganov/whisper.cpp 下载模型文件。

推荐下载：
- `ggml-base.bin` - 适合开发测试
- `ggml-small.bin` - 更好的识别效果

### 3. 编译 Native 模块

```powershell
npm run build:native
```

如果遇到问题，确保已安装：
- Visual Studio Build Tools 2019 或更新版本
- Python 3.x
- CMake

### 4. 编译 TypeScript

```powershell
npm run build
```

### 5. 运行开发模式

```powershell
npm run dev
```

## 项目结构详解

```
LLExtTool/
├── src/                      # TypeScript 源代码
│   ├── main/                 # Electron 主进程
│   │   ├── main.ts          # 应用入口
│   │   ├── ipc-handlers.ts  # IPC 通信处理
│   │   └── config-manager.ts # 配置管理
│   ├── renderer/             # 渲染进程（UI）
│   │   ├── index.html       # 主页面
│   │   ├── renderer.ts      # 前端逻辑
│   │   └── styles/          # 样式文件
│   ├── services/             # 业务服务
│   │   └── translator.ts    # 翻译服务
│   └── shared/               # 共享代码
│       └── types.ts         # 类型定义
├── native/                   # C++ Native 模块
│   ├── include/             # C++ 头文件
│   ├── src/                 # C++ 源文件
│   ├── ffmpeg/              # FFmpeg 库（需下载）
│   └── whisper.cpp/         # Whisper.cpp（需克隆）
├── dist/                     # TypeScript 编译输出
├── build/                    # Native 模块编译输出
├── models/                   # 模型文件
│   ├── whisper/             # Whisper 模型
│   └── translation/         # 翻译模型（可选）
└── release/                  # 打包输出
```

## 开发工作流

### 1. TypeScript 开发

启动监听模式：
```powershell
npm run watch
```

修改 TypeScript 文件后会自动重新编译。

### 2. C++ 模块开发

修改 C++ 代码后，需要重新编译：
```powershell
npm run build:native
```

### 3. 调试

- **主进程调试**: 使用 VS Code 的调试功能，配置在 `.vscode/launch.json`
- **渲染进程调试**: 应用启动后自动打开开发者工具

### 4. 打包应用

```powershell
npm run package
```

打包后的应用在 `release/` 目录。

## 常见开发任务

### 添加新的 IPC 通道

1. 在 `src/shared/types.ts` 的 `IpcChannels` 中添加常量
2. 在 `src/main/ipc-handlers.ts` 中添加处理器
3. 在 `src/renderer/renderer.ts` 中调用

示例：
```typescript
// types.ts
export const IpcChannels = {
  // ...
  NEW_FEATURE: 'new-feature',
};

// ipc-handlers.ts
ipcMain.handle(IpcChannels.NEW_FEATURE, async (_, arg) => {
  // 处理逻辑
  return result;
});

// renderer.ts
const result = await ipcRenderer.invoke(IpcChannels.NEW_FEATURE, arg);
```

### 添加新的 UI 组件

1. 在 `src/renderer/index.html` 中添加 HTML 结构
2. 在 `src/renderer/styles/main.css` 中添加样式
3. 在 `src/renderer/renderer.ts` 中添加交互逻辑

### 修改配置项

在 `src/shared/types.ts` 的 `AppConfig` 接口中添加新字段，`ConfigManager` 会自动处理。

## 代码规范

### TypeScript

- 使用 TypeScript strict 模式
- 为所有函数添加类型注解
- 使用 async/await 而不是 Promise 链
- 错误处理使用 try-catch

### C++

- 使用 C++17 标准
- RAII 原则管理资源
- 使用智能指针避免内存泄漏
- 在 NAPI 绑定中捕获所有异常

## 性能优化建议

### 1. 音频处理

- 分块处理大文件
- 使用流式 API
- 考虑多线程处理

### 2. 语音识别

- 根据硬件选择合适的模型大小
- 考虑使用 GPU 加速
- 实现进度反馈

### 3. 翻译

- 批量处理减少开销
- 缓存翻译结果
- 考虑使用 Web Workers

### 4. UI 响应

- 长时间操作使用 Web Workers
- 实现虚拟滚动（大量字幕）
- 防抖/节流用户输入

## 测试

### 单元测试（待实现）

```powershell
npm test
```

### 集成测试

准备测试视频文件，测试完整流程：
1. 选择视频
2. 提取音频
3. 语音识别
4. 翻译
5. 导出字幕

### 性能测试

测试不同大小视频的处理时间和内存占用。

## 发布流程

1. 更新版本号：`npm version patch/minor/major`
2. 编译所有代码：`npm run build && npm run build:native`
3. 测试功能
4. 打包：`npm run package`
5. 测试打包后的应用
6. 创建 Git tag：`git tag v1.0.0`
7. 推送：`git push && git push --tags`

## 常见问题排查

### Native 模块加载失败

1. 检查 `build/Release/` 目录是否存在 `.node` 文件
2. 检查 DLL 文件是否在正确位置
3. 使用 `dumpbin /dependents` 检查 DLL 依赖

### Electron 启动失败

1. 确保 TypeScript 已编译：`npm run build`
2. 检查 `dist/main/main.js` 是否存在
3. 查看控制台错误信息

### Whisper 识别效果差

1. 使用更大的模型（small/medium）
2. 确保音频质量足够（清晰、无噪音）
3. 检查语言设置是否正确

### 翻译质量不好

1. 尝试使用 NLLB 等更大的模型
2. 考虑使用在线 API（DeepL、GPT）
3. 后处理：修正常见错误

## 贡献指南

1. Fork 项目
2. 创建特性分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -am 'Add new feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 创建 Pull Request

## 许可证

MIT License - 详见 LICENSE 文件
