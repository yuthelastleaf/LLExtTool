# LLExtTool 自动安装脚本
# 此脚本帮助自动下载和配置必要的依赖

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  LLExtTool 安装脚本" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
Write-Host "[1/7] 检查 Node.js..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js 已安装: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ 未找到 Node.js" -ForegroundColor Red
    Write-Host "  请访问 https://nodejs.org 下载并安装 Node.js" -ForegroundColor Red
    exit 1
}

# 检查 npm
Write-Host "[2/7] 检查 npm..." -ForegroundColor Yellow
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmVersion = npm --version
    Write-Host "  ✓ npm 已安装: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ 未找到 npm" -ForegroundColor Red
    exit 1
}

# 安装 npm 依赖
Write-Host "[3/7] 安装 npm 依赖..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ npm 依赖安装完成" -ForegroundColor Green
} else {
    Write-Host "  ✗ npm 依赖安装失败" -ForegroundColor Red
    exit 1
}

# 检查 CMake
Write-Host "[4/7] 检查 CMake..." -ForegroundColor Yellow
if (Get-Command cmake -ErrorAction SilentlyContinue) {
    $cmakeVersion = cmake --version | Select-Object -First 1
    Write-Host "  ✓ CMake 已安装: $cmakeVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ 未找到 CMake" -ForegroundColor Red
    Write-Host "  请访问 https://cmake.org/download/ 下载并安装 CMake" -ForegroundColor Red
    exit 1
}

# 检查 Git
Write-Host "[5/7] 检查 Git..." -ForegroundColor Yellow
if (Get-Command git -ErrorAction SilentlyContinue) {
    $gitVersion = git --version
    Write-Host "  ✓ Git 已安装: $gitVersion" -ForegroundColor Green
} else {
    Write-Host "  ✗ 未找到 Git" -ForegroundColor Red
    Write-Host "  请访问 https://git-scm.com/download/win 下载并安装 Git" -ForegroundColor Red
    exit 1
}

# 克隆 Whisper.cpp
Write-Host "[6/7] 准备 Whisper.cpp..." -ForegroundColor Yellow
if (Test-Path "native\whisper.cpp") {
    Write-Host "  ✓ Whisper.cpp 已存在" -ForegroundColor Green
} else {
    Write-Host "  正在克隆 Whisper.cpp..." -ForegroundColor Cyan
    git clone https://github.com/ggerganov/whisper.cpp.git native\whisper.cpp
    
    if (Test-Path "native\whisper.cpp") {
        Write-Host "  ✓ Whisper.cpp 克隆完成" -ForegroundColor Green
        
        # 编译 Whisper.cpp
        Write-Host "  正在编译 Whisper.cpp..." -ForegroundColor Cyan
        Push-Location native\whisper.cpp
        
        if (-not (Test-Path "build")) {
            New-Item -ItemType Directory -Path "build" | Out-Null
        }
        
        Push-Location build
        cmake ..
        cmake --build . --config Release
        Pop-Location
        Pop-Location
        
        if (Test-Path "native\whisper.cpp\build\bin\Release\whisper.dll") {
            Write-Host "  ✓ Whisper.cpp 编译完成" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Whisper.cpp 编译失败" -ForegroundColor Red
            Write-Host "  请检查 CMake 和 Visual Studio Build Tools 是否正确安装" -ForegroundColor Red
        }
    } else {
        Write-Host "  ✗ Whisper.cpp 克隆失败" -ForegroundColor Red
    }
}

# 检查 FFmpeg
Write-Host "[7/7] 检查 FFmpeg..." -ForegroundColor Yellow
if (Test-Path "native\ffmpeg\bin") {
    Write-Host "  ✓ FFmpeg 已存在" -ForegroundColor Green
} else {
    Write-Host "  ✗ 未找到 FFmpeg" -ForegroundColor Yellow
    Write-Host "" -ForegroundColor Yellow
    Write-Host "  请手动下载 FFmpeg:" -ForegroundColor Yellow
    Write-Host "  1. 访问: https://github.com/BtbN/FFmpeg-Builds/releases" -ForegroundColor Cyan
    Write-Host "  2. 下载: ffmpeg-master-latest-win64-gpl-shared.zip" -ForegroundColor Cyan
    Write-Host "  3. 解压到项目根目录" -ForegroundColor Cyan
    Write-Host "  4. 将解压的文件夹重命名并移动到: native\ffmpeg\" -ForegroundColor Cyan
    Write-Host ""
}

# 创建必要的目录
Write-Host "创建必要的目录..." -ForegroundColor Yellow
$directories = @("models\whisper", "models\translation", "dist", "build")
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  ✓ 创建目录: $dir" -ForegroundColor Green
    }
}

# 总结
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  安装总结" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# 检查 Native 模块目录
Write-Host "下一步操作:" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path "native\ffmpeg\bin")) {
    Write-Host "  [ ] 下载并配置 FFmpeg" -ForegroundColor Red
    $allGood = $false
} else {
    Write-Host "  [✓] FFmpeg 已配置" -ForegroundColor Green
}

if (-not (Test-Path "native\whisper.cpp\build\bin\Release\whisper.dll")) {
    Write-Host "  [ ] 编译 Whisper.cpp" -ForegroundColor Red
    $allGood = $false
} else {
    Write-Host "  [✓] Whisper.cpp 已编译" -ForegroundColor Green
}

Write-Host ""
Write-Host "  [ ] 下载 Whisper 模型到 models\whisper\" -ForegroundColor Yellow
Write-Host "      推荐: ggml-base.bin" -ForegroundColor Cyan
Write-Host "      下载: https://huggingface.co/ggerganov/whisper.cpp/tree/main" -ForegroundColor Cyan
Write-Host ""

if ($allGood) {
    Write-Host "环境准备完成！" -ForegroundColor Green
    Write-Host ""
    Write-Host "现在运行:" -ForegroundColor Yellow
    Write-Host "  1. npm run build:native   # 编译 Native 模块" -ForegroundColor Cyan
    Write-Host "  2. npm run build          # 编译 TypeScript" -ForegroundColor Cyan
    Write-Host "  3. npm start              # 启动应用" -ForegroundColor Cyan
} else {
    Write-Host "请完成上述步骤后，再运行:" -ForegroundColor Yellow
    Write-Host "  npm run build:native && npm run build && npm start" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "更多帮助请查看 QUICKSTART.md" -ForegroundColor Yellow
Write-Host ""
