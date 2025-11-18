# CTranslate2 安装指南

## 推荐方案：使用预编译版本 ⭐

**最简单、最快速的方法！**

```powershell
# 一键安装预编译版本
.\scripts\install-ctranslate2.ps1

# 验证安装
node test-translate.js
```

**优点:**
- ✅ 无需编译，3 分钟完成
- ✅ 无需 Visual Studio
- ✅ 无需处理依赖问题
- ✅ 官方构建，稳定可靠

**适用场景:**
- 快速开始项目
- 不需要自定义编译选项
- 避免编译环境配置问题

---

## 方案对比

| 方案 | 时间 | 难度 | 需要工具 | 适用场景 |
|------|------|------|----------|----------|
| **预编译版本** | 3分钟 | ⭐ | 无 | 推荐！快速开始 |
| 本地编译 | 20-30分钟 | ⭐⭐⭐ | VS + CMake | 自定义优化 |

---

## 方案 1: 预编译版本（推荐）

### 步骤

```powershell
# 1. 下载并安装
.\scripts\install-ctranslate2.ps1

# 2. 验证
node test-translate.js

# 3. 重新编译项目（如果需要）
npm run build
```

### 预期输出

```
=== CTranslate2 快速安装 (预编译版本) ===

安装目录: F:\GitProject\LLExtTool\native\ctranslate2
版本: 4.5.0

正在下载 CTranslate2 v4.5.0...
✓ 下载完成

正在解压...
✓ 解压完成

正在安装到项目目录...
✓ 安装完成

=== 验证安装 ===

✓ ctranslate2.dll
✓ ctranslate2.lib
✓ translator.h

=== 安装成功！===
```

### 故障排除

**下载失败？**
```powershell
# 手动下载
# 1. 访问: https://github.com/OpenNMT/CTranslate2/releases
# 2. 下载: ctranslate2-4.5.0-windows-x64.zip
# 3. 解压到: native/ctranslate2/
```

---

## 方案 2: 本地编译

### 前提条件

- Visual Studio 2019/2022（C++ 桌面开发）
- CMake 3.7+
- Git

### 步骤

#### A. 完整 Git 克隆（推荐）

```powershell
# 1. 克隆源码（包含子模块）
cd native
git clone --recursive https://github.com/OpenNMT/CTranslate2.git ctranslate2

# 2. 编译
.\scripts\build-ctranslate2.ps1

# 3. 验证
node test-translate.js
```

#### B. 已有源码（需初始化子模块）

```powershell
# 1. 初始化 Git 子模块
cd native/ctranslate2
git submodule update --init --recursive
cd ../..

# 2. 编译
.\scripts\build-ctranslate2.ps1

# 3. 验证
node test-translate.js
```

### 编译选项

```powershell
# CPU 版本（默认）
.\scripts\build-ctranslate2.ps1

# GPU 版本（需要 CUDA）
.\scripts\build-ctranslate2.ps1 -CUDA

# 清理重编译
.\scripts\build-ctranslate2.ps1 -Clean
```

### 常见错误

#### 错误 1: 子模块未初始化

```
CMake Error: The source directory
  F:/GitProject/LLExtTool/native/ctranslate2/third_party/spdlog
  does not contain a CMakeLists.txt file.
```

**解决:**
```powershell
cd native/ctranslate2
git submodule update --init --recursive
```

#### 错误 2: Intel OpenMP 未找到

```
CMake Error: Intel OpenMP runtime libiomp5 not found
```

**解决:**
脚本已禁用 OpenMP。如果仍报错：
```powershell
# 清理 CMake 缓存
Remove-Item native/ctranslate2/build -Recurse -Force
.\scripts\build-ctranslate2.ps1
```

#### 错误 3: Visual Studio 未找到

```
CMake Error: CMake was unable to find a build program
```

**解决:**
1. 安装 Visual Studio 2022
2. 选择 "C++ 桌面开发" 工作负载
3. 重启终端

---

## 验证安装

运行测试脚本:

```powershell
node test-translate.js
```

### 成功输出示例

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

---

## 下载翻译模型

安装好 CTranslate2 后，还需要翻译模型:

```powershell
# 安装 Python 依赖
pip install ctranslate2 transformers

# 转换 OPUS-MT 日英翻译模型
ct2-transformers-converter `
  --model Helsinki-NLP/opus-mt-ja-zh `
  --output_dir native/models/opus-mt-ja-zh-ct2 `
  --quantization int8
```

---

## 性能对比

| 方案 | 编译时间 | 运行性能 | 文件大小 |
|------|---------|---------|---------|
| 预编译（默认） | 0 分钟 | 100% | ~50 MB |
| 本地编译（无优化） | 20 分钟 | 100% | ~50 MB |
| 本地编译（MKL） | 30 分钟 | 200% | ~200 MB |
| 本地编译（CUDA） | 25 分钟 | 500%+ | ~100 MB |

**结论:** 对于大多数用户，**预编译版本**已经足够！

---

## 快速决策

**选择预编译版本，如果:**
- ✅ 你想快速开始
- ✅ 你不需要特殊优化
- ✅ 你想避免编译问题

**选择本地编译，如果:**
- ✅ 你需要 CUDA GPU 加速
- ✅ 你需要 Intel MKL 优化
- ✅ 你想自定义编译选项
- ✅ 你需要最新开发版本

---

## 下一步

安装完成后:

1. **测试翻译模块**
   ```powershell
   node test-translate.js
   ```

2. **下载翻译模型**
   ```powershell
   pip install ctranslate2 transformers
   ct2-transformers-converter --model Helsinki-NLP/opus-mt-ja-zh --output_dir native/models/opus-mt-ja-zh-ct2
   ```

3. **重新编译项目**
   ```powershell
   npm run build
   ```

4. **启动应用**
   ```powershell
   npm start
   ```

---

## 获取帮助

**常见问题:** 查看 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

**GitHub Issues:** https://github.com/OpenNMT/CTranslate2/issues

**项目讨论:** https://gitter.im/OpenNMT/CTranslate2
