# 本地编译 CTranslate2 指南

## 快速开始

### 1. 准备环境

**必需工具:**
- Visual Studio 2019 或 2022（安装 C++ 桌面开发组件）
- CMake 3.7+ 
- Git（可选，用于克隆源码）

**检查工具:**
```powershell
# 检查 Visual Studio
"${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest

# 检查 CMake
cmake --version

# 检查 Git
git --version
```

### 2. 获取源码

**方法 A: 使用 Git**
```powershell
cd native
git clone https://github.com/OpenNMT/CTranslate2.git ctranslate2
```

**方法 B: 下载 ZIP**
1. 访问: https://github.com/OpenNMT/CTranslate2
2. 点击 "Code" → "Download ZIP"
3. 解压到 `native/ctranslate2/`

### 3. 编译

**CPU 版本（推荐）:**
```powershell
.\scripts\build-ctranslate2.ps1
```

**GPU 版本（需要 CUDA）:**
```powershell
.\scripts\build-ctranslate2.ps1 -CUDA
```

**清理重编译:**
```powershell
.\scripts\build-ctranslate2.ps1 -Clean
```

### 4. 验证

```powershell
node test-translate.js
```

预期输出:
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
```

## 编译选项详解

### CMake 配置选项

编译脚本使用的默认配置:

```cmake
-DCMAKE_BUILD_TYPE=Release      # 发布版本（优化性能）
-DBUILD_SHARED_LIBS=ON          # 编译动态库 (.dll)
-DBUILD_CLI=OFF                 # 不编译命令行工具
-DBUILD_TESTS=OFF               # 不编译测试
-DWITH_MKL=OFF                  # 不使用 Intel MKL
-DWITH_CUDA=OFF                 # 不使用 CUDA（CPU版本）
```

### 性能优化选项

**启用 Intel MKL（Intel CPU 专用优化）:**
```cmake
-DWITH_MKL=ON
-DINTEL_ROOT="C:/Program Files (x86)/Intel/oneAPI"
```

**启用 CUDA GPU 加速:**
```cmake
-DWITH_CUDA=ON
-DWITH_CUDNN=ON
-DCUDA_TOOLKIT_ROOT_DIR="C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v11.8"
```

## 编译时间

- **CPU 版本**: 约 10-20 分钟
- **GPU 版本**: 约 15-30 分钟

具体时间取决于:
- CPU 性能（建议 4 核以上）
- 内存大小（建议 8GB 以上）
- 是否首次编译

## 编译产物

成功编译后，文件位置:

```
native/ctranslate2-built/
├── bin/
│   └── ctranslate2.dll          # 动态链接库
├── lib/
│   └── ctranslate2.lib          # 导入库
└── include/
    └── ctranslate2/
        ├── translator.h         # 主要头文件
        └── ...                  # 其他头文件
```

## 常见问题

### Q1: CMake 找不到 Visual Studio

**原因**: Visual Studio 安装不完整或路径问题

**解决**:
```powershell
# 检查 Visual Studio 安装
& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest

# 手动指定生成器
cmake -G "Visual Studio 17 2022" -A x64 ...
```

### Q2: 编译时内存不足

**原因**: 并行编译占用过多内存

**解决**:
```powershell
# 修改编译脚本，减少并行进程数
cmake --build . --config Release --parallel 2
```

### Q3: 找不到某些依赖库

**原因**: 缺少 Visual Studio C++ 组件

**解决**:
1. 打开 Visual Studio Installer
2. 选择 "修改"
3. 确保已安装:
   - MSVC v143 - VS 2022 C++ x64/x86 生成工具
   - Windows 11 SDK
   - C++ CMake 工具

### Q4: CUDA 编译失败

**原因**: CUDA Toolkit 版本不兼容

**解决**:
1. 检查 CTranslate2 支持的 CUDA 版本
2. 安装匹配的 CUDA Toolkit
3. 设置环境变量: `$env:CUDA_PATH`

### Q5: 编译成功但运行时找不到 DLL

**原因**: DLL 路径配置问题

**解决**:
```powershell
# 将 DLL 复制到可执行文件目录
Copy-Item native\ctranslate2-built\bin\*.dll build\Release\
```

## 优化建议

### 编译速度优化

1. **使用 SSD**: 将项目放在 SSD 上
2. **增加内存**: 至少 8GB，推荐 16GB
3. **使用 Ninja**: 比 MSBuild 更快
   ```powershell
   cmake -G "Ninja" -DCMAKE_BUILD_TYPE=Release ...
   ```

### 运行性能优化

1. **启用 CPU 调度**: `-DENABLE_CPU_DISPATCH=ON`（默认已启用）
2. **使用 Intel MKL**: 在 Intel CPU 上性能提升 2-3 倍
3. **使用 CUDA**: 在支持的 GPU 上性能提升 5-10 倍
4. **量化模型**: 使用 int8 量化减少内存和提升速度

## 下一步

编译成功后:

1. **重新编译项目**:
   ```powershell
   npm run build
   ```

2. **下载翻译模型**:
   ```powershell
   pip install ctranslate2 transformers
   ct2-transformers-converter --model Helsinki-NLP/opus-mt-ja-zh --output_dir native/models/opus-mt-ja-zh-ct2
   ```

3. **测试翻译功能**:
   ```powershell
   node test-translate.js
   ```

4. **启动应用**:
   ```powershell
   npm start
   ```

## 参考资料

- CTranslate2 官方文档: https://opennmt.net/CTranslate2/
- GitHub 仓库: https://github.com/OpenNMT/CTranslate2
- 编译指南: https://opennmt.net/CTranslate2/installation.html
